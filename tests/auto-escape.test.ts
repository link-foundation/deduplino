import { expect, test, describe } from "bun:test";
import { deduplicate } from "../src/deduplicator";

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