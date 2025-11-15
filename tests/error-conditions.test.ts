import { test, describe, expect } from "test-anywhere";
import { deduplicate } from "../src/deduplicator";
import { ParseError } from "../src/errors";

describe("Error Conditions", () => {
  describe("Input validation", () => {
    test("should handle empty input gracefully", () => {
      const result = deduplicate("");
      expect(result.success).toBe(false);
      expect(result.reason).toBe("Empty input");
      expect(result.patternsApplied).toBe(0);
    });

    test("should handle whitespace-only input", () => {
      const result = deduplicate("   \n  \t  ");
      expect(result.success).toBe(false);
      expect(result.reason).toBe("Empty input");
    });

    test("should handle very long input without crashing", () => {
      // Create a large but valid input
      const largeInput = Array(1000).fill("(test link)").join("\n");
      const result = deduplicate(largeInput);
      expect(result.success).toBe(true);
    });
  });

  describe("Parsing errors", () => {
    test("should fail on invalid lino format when failOnParseError is true", () => {
      const invalidInput = "this is not (valid lino";

      expect(() => {
        deduplicate(invalidInput, 0.2, false, true);
      }).toThrow(ParseError);
    });

    test("should not throw when failOnParseError is false", () => {
      const invalidInput = "this is not (valid lino";

      const result = deduplicate(invalidInput, 0.2, false, false);
      expect(result.success).toBe(false);
      expect(result.reason).toBe("Parsing failed");
    });

    test("should handle unbalanced parentheses", () => {
      const input = "((( ))"; // 3 opening, 2 closing - unbalanced

      expect(() => {
        deduplicate(input, 0.2, false, true);
      }).toThrow(ParseError);
    });
  });

  describe("Threshold validation", () => {
    test("should accept threshold of 0", () => {
      const input = "(test link)\n(test link)";
      const result = deduplicate(input, 0);
      // With threshold 0, Math.max(1, 0) still applies at least 1 pattern
      expect(result.success).toBe(true);
      expect(result.patternsApplied).toBeGreaterThanOrEqual(1);
    });

    test("should accept threshold of 1", () => {
      const input = "(test link)\n(test link)";
      const result = deduplicate(input, 1);
      expect(result.success).toBe(true);
    });

    test("should work with threshold of 0.5", () => {
      const input = "(test link)\n(test link)";
      const result = deduplicate(input, 0.5);
      expect(result.success).toBe(true);
    });
  });

  describe("Edge cases in pattern detection", () => {
    test("should handle links with single reference (no deduplication)", () => {
      const input = "(a)\n(b)\n(c)";
      const result = deduplicate(input, 1.0);
      expect(result.success).toBe(false);
      expect(result.reason).toBe("No deduplication patterns found");
    });

    test("should handle empty links", () => {
      const input = "()\n()";
      const result = deduplicate(input, 1.0);
      // Empty links don't have content to deduplicate
      expect(result.patternsApplied).toBe(0);
    });

    test("should handle mixed valid and single-reference links", () => {
      const input = "(a)\n(b c)\n(b c)";
      const result = deduplicate(input, 1.0);
      expect(result.success).toBe(true);
      expect(result.patternsApplied).toBe(1);
    });

    test("should not create patterns that appear only once", () => {
      const input = "(unique pattern here)\n(different pattern there)";
      const result = deduplicate(input, 1.0);
      expect(result.success).toBe(false);
      expect(result.reason).toBe("No deduplication patterns found");
    });
  });

  describe("Auto-escape edge cases", () => {
    test("should handle nested quotes", () => {
      const input = `test "inner 'quote' here" text`;
      const result = deduplicate(input, 0.2, true, false);
      expect(result.output).toBeTruthy();
    });

    test("should handle multiple colons in sequence", () => {
      const input = `test::: value`;
      const result = deduplicate(input, 0.2, true, false);
      expect(result.output).toContain("'test:::'");
    });

    test("should handle URLs with protocol", () => {
      const input = `visit http://example.com:8080/path`;
      const result = deduplicate(input, 0.2, true, false);
      expect(result.output).toContain("'http://example.com:8080/path'");
    });

    test("should handle empty lines in multiline input", () => {
      const input = `line1\n\nline2\n\n\nline3`;
      const result = deduplicate(input, 0.2, true, false);
      expect(result.output).toBeTruthy();
    });
  });

  describe("Pattern scoring and selection", () => {
    test("should prefer longer patterns over shorter ones with same frequency", () => {
      const input = `(a b c d)
(a b c d)
(x y)
(x y)`;

      const result = deduplicate(input, 0.5); // Only 50% of patterns
      expect(result.output).toContain("1: a b c d");
    });

    test("should prefer more frequent patterns over longer but rare ones", () => {
      const input = `(a b)
(a b)
(a b)
(a b)
(x y z w)
(x y z w)`;

      const result = deduplicate(input, 0.5);
      // 'a b' appears 4 times (score: 4*2=8)
      // 'x y z w' appears 2 times (score: 2*4=8)
      // Should prefer the one with higher count in case of tie
      expect(result.output).toContain("1: a b");
    });
  });

  describe("Special characters handling", () => {
    test("should handle tabs and newlines", () => {
      const input = "(test\tlink)\n(test\tlink)";
      // Tabs might be normalized by the parser
      const result = deduplicate(input, 1.0);
      expect(result.output).toBeTruthy();
    });

    test("should handle unicode characters", () => {
      const input = "(héllo wörld 🌍)\n(héllo wörld 🌍)";
      const result = deduplicate(input, 1.0);
      expect(result.success).toBe(true);
    });

    test("should handle quotes within references", () => {
      const input = `('quoted' text)
('quoted' text)`;
      const result = deduplicate(input, 1.0);
      expect(result.success).toBe(true);
    });
  });
});
