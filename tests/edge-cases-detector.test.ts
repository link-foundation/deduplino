import { test, describe, expect } from "test-anywhere";
import { detectEdgeCases, analyzeEdgeCases } from "../src/edge-cases-detector";

describe("Edge Case Detector", () => {
  describe("detectEdgeCases", () => {
    test("should detect no edge cases for valid input", () => {
      const content = `valid line
another valid line
(valid lino)`;

      const edgeCases = detectEdgeCases(content);
      expect(edgeCases.length).toBe(0);
    });

    test("should detect unbalanced parentheses", () => {
      const content = `valid line
))((( unbalanced
another valid line`;

      const edgeCases = detectEdgeCases(content);
      expect(edgeCases.length).toBe(1);
      expect(edgeCases[0].lineNumber).toBe(2);
      expect(edgeCases[0].originalLine).toBe("))((( unbalanced");
    });

    test("should skip empty lines", () => {
      const content = `line1

line3`;

      const edgeCases = detectEdgeCases(content);
      expect(edgeCases.length).toBe(0);
      // Should have processed only 2 lines (not counting empty line)
      expect((edgeCases as any).totalLinesProcessed).toBe(2);
    });

    test("should track correct line numbers", () => {
      const content = `line1
line2
))((
line4`;

      const edgeCases = detectEdgeCases(content);
      expect(edgeCases.length).toBe(1);
      expect(edgeCases[0].lineNumber).toBe(3);
    });

    test("should handle multiple edge cases", () => {
      const content = `))((
valid line
( ( (
another valid
))((`; const edgeCases = detectEdgeCases(content);
      expect(edgeCases.length).toBe(3);
      expect(edgeCases[0].lineNumber).toBe(1);
      expect(edgeCases[1].lineNumber).toBe(3);
      expect(edgeCases[2].lineNumber).toBe(5);
    });

    test("should calculate total lines correctly", () => {
      const content = `line1
line2

line4`;

      const edgeCases = detectEdgeCases(content);
      // Should count only non-empty lines: 3
      expect((edgeCases as any).totalLinesProcessed).toBe(3);
    });

    test("should handle content with only whitespace lines", () => {
      const content = `
  \t
  `;

      const edgeCases = detectEdgeCases(content);
      expect(edgeCases.length).toBe(0);
      expect((edgeCases as any).totalLinesProcessed).toBe(0);
    });
  });

  describe("analyzeEdgeCases", () => {
    test("should output success message for zero edge cases", () => {
      const edgeCases: any[] = [];
      edgeCases.totalLinesProcessed = 10;

      // Just verify it doesn't throw
      // TODO: test-anywhere bug - expect().not.toThrow() is not supported
      // expect(() => {
      //   analyzeEdgeCases(edgeCases);
      // }).not.toThrow();
      analyzeEdgeCases(edgeCases); // Just call directly for now
    });

    test("should handle edge cases array with metadata", () => {
      const edgeCases: any[] = [
        {
          lineNumber: 1,
          originalLine: "))(((",
          error: "Parse error"
        }
      ];
      edgeCases.totalLinesProcessed = 5;

      // Just verify it doesn't throw
      // TODO: test-anywhere bug - expect().not.toThrow() is not supported
      // expect(() => {
      //   analyzeEdgeCases(edgeCases);
      // }).not.toThrow();
      analyzeEdgeCases(edgeCases); // Just call directly for now
    });

    test("should handle missing totalLinesProcessed gracefully", () => {
      const edgeCases = [
        {
          lineNumber: 1,
          originalLine: "))(((",
          error: "Parse error"
        }
      ];

      // Should fallback to edge cases length
      analyzeEdgeCases(edgeCases);
    });
  });

  describe("Pattern categorization", () => {
    test("should detect unbalanced parentheses pattern", () => {
      const content = "))(((\n))(((";

      const edgeCases = detectEdgeCases(content);
      expect(edgeCases.length).toBe(2);
      // Both should be detected as having parentheses issues
      edgeCases.forEach(ec => {
        expect(ec.originalLine).toMatch(/[()]/);
      });
    });

    test("should handle mixed pattern types", () => {
      const content = `))((
( ( (
some valid content
))(())((`;
      const edgeCases = detectEdgeCases(content);
      expect(edgeCases.length).toBe(3);
    });
  });

  describe("Edge cases with auto-escape", () => {
    test("should detect cases that auto-escape cannot fix", () => {
      // These should fail even with auto-escape
      const content = `))((
normal: content
( ) ) (`;

      const edgeCases = detectEdgeCases(content);
      // TODO: test-anywhere bug - expect().toBeGreaterThan() is not supported
      // expect(edgeCases.length).toBeGreaterThan(0);
      expect(edgeCases.length > 0).toBe(true);
    });

    test("should not detect cases that auto-escape can fix", () => {
      // These should be fixable with auto-escape
      const content = `timestamp: 2025-01-01T10:30:00Z
url: http://example.com
key: value`;

      const edgeCases = detectEdgeCases(content);
      expect(edgeCases.length).toBe(0);
    });
  });

  describe("Statistics calculation", () => {
    test("should calculate success rate correctly", () => {
      const content = `line1
line2
))((
line4
line5`;

      const edgeCases = detectEdgeCases(content);
      const totalLines = (edgeCases as any).totalLinesProcessed;
      const failedLines = edgeCases.length;

      expect(totalLines).toBe(5);
      expect(failedLines).toBe(1);

      const successRate = (1 - failedLines / totalLines) * 100;
      expect(successRate).toBe(80);
    });

    test("should handle 100% success rate", () => {
      const content = `line1
line2
line3`;

      const edgeCases = detectEdgeCases(content);
      expect(edgeCases.length).toBe(0);
      expect((edgeCases as any).totalLinesProcessed).toBe(3);
    });

    test("should handle 0% success rate", () => {
      const content = `))((
( ) ) (
( ( (`;

      const edgeCases = detectEdgeCases(content);
      expect(edgeCases.length).toBe(3);
      expect((edgeCases as any).totalLinesProcessed).toBe(3);
    });
  });
});
