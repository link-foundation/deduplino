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
    
    const expected = `(1: a)
1
1
(b)
(b)`;
    
    const result = deduplicate(input);
    expect(result).toBe(expected);
  });

  test("should prioritize most frequent references with default 20% threshold", () => {
    const input = `(frequent)
(frequent)
(frequent)
(less)
(less)`;
    
    const expected = `(1: frequent)
1
1
(less)
(less)`;
    
    const result = deduplicate(input);
    expect(result).toBe(expected);
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

  describe("Sequence extension patterns", () => {
    test("should handle 2-word sequence", () => {
      const input = `(this is) a link
(this is) a link`;
      
      const expected = `(1: this is) a link
1 a link`;
      
      const result = deduplicate(input, 1.0);
      expect(result).toBe(expected);
    });

    test("should handle 3-word sequence", () => {
      const input = `(this is a) link
(this is a) link`;
      
      const expected = `(1: this is a) link
1 link`;
      
      const result = deduplicate(input, 1.0);
      expect(result).toBe(expected);
    });

    test("should handle 4-word sequence with 3 occurrences", () => {
      const input = `(this is a link)
(this is a link)
(this is a link)`;
      
      const expected = `(1: this is a link)
1
1`;
      
      const result = deduplicate(input, 1.0);
      expect(result).toBe(expected);
    });

    test("should handle 5-word sequence", () => {
      const input = `(this is a long link)
(this is a long link)`;
      
      const expected = `(1: this is a long link)
1`;
      
      const result = deduplicate(input, 1.0);
      expect(result).toBe(expected);
    });

    test("should handle 6-word sequence", () => {
      const input = `(this is a very long link)
(this is a very long link)`;
      
      const expected = `(1: this is a very long link)
1`;
      
      const result = deduplicate(input, 1.0);
      expect(result).toBe(expected);
    });

    test("should handle 7-word sequence", () => {
      const input = `(this is a really very long link)
(this is a really very long link)`;
      
      const expected = `(1: this is a really very long link)
1`;
      
      const result = deduplicate(input, 1.0);
      expect(result).toBe(expected);
    });

    test("should find common prefixes", () => {
      const input = `(this is a link of cat)
(this is a link of tree)`;
      
      const expected = `(1: this is a link of)
1 cat
1 tree`;
      
      const result = deduplicate(input, 1.0);
      expect(result).toBe(expected);
    });

    test("should handle multiple prefix patterns", () => {
      const input = `(this is a link of cat)
(this is a link of tree)
(this is a different thing)
(this is a different item)`;
      
      const expected = `(1: this is a link of)
1 cat
1 tree
(2: this is a different)
2 thing
2 item`;
      
      const result = deduplicate(input, 1.0);
      expect(result).toBe(expected);
    });
  });
});