import { expect, test, describe } from "bun:test";
import { deduplicate } from "../src/deduplicator";

describe("Lino Deduplicator", () => {
  test("should handle basic deduplication", () => {
    const input = `(a link)
(a link)`;
    
    const expected = `(1: a link)
1`;
    
    const result = deduplicate(input);
    expect(result).toBe(expected);
  });

  test("should handle three occurrences", () => {
    const input = `(a link)
(a link)
(a link)`;
    
    const expected = `(1: a link)
1
1`;
    
    const result = deduplicate(input);
    expect(result).toBe(expected);
  });

  test("should handle single occurrence (no deduplication needed)", () => {
    const input = "(unique)";
    const result = deduplicate(input);
    expect(result).toBe(input);
  });

  test("should handle multiple different links", () => {
    const input = `(first)
(second)
(first)`;
    
    const expected = `(1: first)
(second)
1`;
    
    const result = deduplicate(input);
    expect(result).toBe(expected);
  });

  test("should handle two pairs of duplicates with different frequencies", () => {
    const input = `(a)
(a)
(a)
(b)
(b)`;
    
    const result = deduplicate(input);
    
    // With 20% rule: 2 duplicated links, ceil(2 * 0.2) = 1, so only most frequent processed
    expect(result).toContain("(1: a)");
    expect(result).not.toContain("(2:");
  });

  test("should prioritize most frequent references", () => {
    const input = `(frequent)
(frequent)
(frequent)
(less)
(less)`;
    
    const result = deduplicate(input);
    
    // Most frequent should get reference 1
    expect(result).toContain("(1: frequent)");
    // With 20% rule and 2 duplicated links, ceil(2 * 0.2) = 1, so only most frequent processed
    expect(result).not.toContain("(2:");
  });

  test("should handle empty input", () => {
    const result = deduplicate("");
    expect(result).toBe("");
  });

  test("should handle input without parentheses", () => {
    const input = "no parentheses here";
    const result = deduplicate(input);
    expect(result).toBe(input);
  });
});