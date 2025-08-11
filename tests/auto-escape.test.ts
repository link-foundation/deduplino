import { expect, test, describe } from "bun:test";
import { deduplicate } from "../src/deduplicator";
import { ParseError } from "../src/errors";

describe("Auto-escape functionality", () => {
  test("should escape timestamps with colons", () => {
    const input = `2025-07-25T21:32:46Z updateCompletionTokens token`;
    
    const expected = `'2025-07-25T21:32:46Z' updateCompletionTokens token`;
    
    const result = deduplicate(input, 0.2, true);
    expect(result).toBe(expected);
  });

  test("should escape URL-like references with colons", () => {
    const input = `error: connection failed at server:8080`;
    
    const expected = `error: connection failed at 'server:8080'`;
    
    const result = deduplicate(input, 0.2, true);
    expect(result).toBe(expected);
  });

  test("should escape problematic parentheses references", () => {
    const input = `(broken reference {`;
    
    const expected = `'(broken' reference {`;
    
    const result = deduplicate(input, 0.2, true);
    expect(result).toBe(expected);
  });

  test("should handle mixed quoting styles elegantly", () => {
    const input = `'already quoted' normal "double quoted" time: 2025-01-01T10:30:00Z`;
    
    // Should preserve quotes and only escape colon references (lino normalizes to single quotes)
    const expected = `'already quoted' normal 'double quoted' 'time:' '2025-01-01T10:30:00Z'`;
    
    const result = deduplicate(input, 0.2, true);
    expect(result).toBe(expected);
  });

  test("should preserve simple punctuation", () => {
    const input = `{ name: test }`;
    
    const expected = `{ 'name:' test }`;
    
    const result = deduplicate(input, 0.2, true);
    expect(result).toBe(expected);
  });

  test("should process multi-line log format with deduplication", () => {
    const input = `2025-07-25T21:32:46Z updateReferences reference {
2025-07-25T21:32:46Z   id: a43fad436
2025-07-25T21:32:46Z }`;

    // Auto-escape + deduplication creates patterns for repeated timestamps
    const expected = `1: '2025-07-25T21:32:46Z'
1 updateReferences reference {
1 'id:' a43fad436
1 }`;

    const result = deduplicate(input, 0.2, true);
    expect(result).toBe(expected);
  });

  test("should not auto-escape when option is disabled", () => {
    const input = `2025-07-25T21:32:46Z updateCompletionTokens`;
    
    const result = deduplicate(input, 0.2, false);
    expect(result).toBe(input);
  });
});

describe("Auto-escape failure cases", () => {
  test("should fail on unbalanced parentheses even with auto-escape", () => {
    const input = `( ) ) ( unbalanced`;
    
    expect(() => {
      deduplicate(input, 0.2, true, true); // auto-escape=true, fail-on-parse-error=true
    }).toThrow(ParseError);
  });

  test("should fail on sequences of only parentheses", () => {
    const input = `))(((`;
    
    expect(() => {
      deduplicate(input, 0.2, true, true);
    }).toThrow(ParseError);
  });

  test("should fail on unbalanced nested parentheses structures", () => {
    const input = `( ( ( ) )`;
    
    expect(() => {
      deduplicate(input, 0.2, true, true);
    }).toThrow(ParseError);
  });

  test("should show what auto-escape does to complex cases", () => {
    // These cases actually get fixed by auto-escape aggressive fallback
    const input1 = `(unclosed (nested structure`;
    const result1 = deduplicate(input1, 0.2, true, false);
    expect(result1).toBe("'(unclosed' '(nested' structure");
    
    const input2 = `(mixed ] bracket types)`;
    const result2 = deduplicate(input2, 0.2, true, false);
    expect(result2).toBe("mixed ] bracket types");
    
    const input3 = `(level1 (level2 (level3 missing close`;
    const result3 = deduplicate(input3, 0.2, true, false);
    expect(result3).toBe("'(level1' '(level2' '(level3' missing close");
  });

  test("should handle special characters that need escaping", () => {
    const input = `file@host.com:port user#123 path/to/file`;
    const expected = `'file@host.com:port' user#123 path/to/file`;
    
    const result = deduplicate(input, 0.2, true, false);
    expect(result).toBe(expected);
  });

  test("should handle mixed content with parentheses and colons", () => {
    const input = `process(id): value time:now status`;
    const expected = `'process(id):' value 'time:now' status`;
    
    const result = deduplicate(input, 0.2, true, false);
    expect(result).toBe(expected);
  });

  test("should preserve valid lino structure when auto-escape is enabled", () => {
    const input = `(valid structure) normal content`;
    const expected = `(valid structure) normal content`;
    
    const result = deduplicate(input, 0.2, true, false);
    expect(result).toBe(expected);
  });
});