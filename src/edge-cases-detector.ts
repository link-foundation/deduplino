import { readFileSync } from 'fs';
import { deduplicate } from './deduplicator.js';
import { ParseError } from './errors.js';

interface EdgeCase {
  lineNumber: number;
  originalLine: string;
  error: string;
}

/**
 * Detects lines in content that cannot be parsed even with auto-escape enabled.
 * @param content - Multi-line text content to analyze
 * @returns Array of edge cases that failed to parse
 */
export function detectEdgeCases(content: string): EdgeCase[] {
  const lines = content.split('\n');
  const edgeCases: EdgeCase[] = [];
  let totalLinesProcessed = 0;

  lines.forEach((line, index) => {
    // Skip empty lines
    if (!line.trim()) return;

    totalLinesProcessed++;

    try {
      // Try to deduplicate with auto-escape and fail-on-parse-error enabled
      deduplicate(line, 0.2, true, true);
    } catch (error) {
      if (error instanceof ParseError) {
        edgeCases.push({
          lineNumber: index + 1,
          originalLine: line,
          error: error.message
        });
      }
    }
  });

  // Store total lines for accurate statistics
  (edgeCases as any).totalLinesProcessed = totalLinesProcessed;

  return edgeCases;
}

/**
 * Analyzes and displays edge cases found in content, grouped by pattern type.
 * @param edgeCases - Array of edge cases to analyze and display
 */
export function analyzeEdgeCases(edgeCases: EdgeCase[]): void {
  if (edgeCases.length === 0) {
    console.log('✅ No edge cases found! All lines can be parsed after auto-escape.');
    return;
  }

  console.log(`🔍 Found ${edgeCases.length} edge case(s) that auto-escape cannot fix:\n`);

  // Group by common patterns
  const patterns = new Map<string, EdgeCase[]>();
  
  edgeCases.forEach(edgeCase => {
    // Simple pattern detection based on content characteristics
    let pattern = 'Other';
    
    if (edgeCase.originalLine.includes('))(') || edgeCase.originalLine.includes('(()')) {
      pattern = 'Unbalanced Parentheses';
    } else if (/^[\s()]+$/.test(edgeCase.originalLine)) {
      pattern = 'Only Punctuation';
    } else if ((edgeCase.originalLine.match(/\(/g) || []).length !== (edgeCase.originalLine.match(/\)/g) || []).length) {
      pattern = 'Mismatched Brackets';
    } else if (edgeCase.originalLine.includes('((') && !edgeCase.originalLine.includes('))')) {
      pattern = 'Nested Unclosed';
    } else if (edgeCase.originalLine.includes("'") && edgeCase.originalLine.endsWith(',')) {
      pattern = 'Quoted Content with Trailing Comma';
    }
    
    if (!patterns.has(pattern)) {
      patterns.set(pattern, []);
    }
    patterns.get(pattern)!.push(edgeCase);
  });

  // Display grouped results
  patterns.forEach((cases, pattern) => {
    console.log(`📂 ${pattern} (${cases.length} cases):`);
    cases.forEach(edgeCase => {
      console.log(`   Line ${edgeCase.lineNumber}: "${edgeCase.originalLine}"`);
    });
    console.log();
  });

  // Show some statistics
  const totalLines = (edgeCases as any).totalLinesProcessed || edgeCases.length;
  console.log('📊 Statistics:');
  console.log(`   Total lines processed: ${totalLines}`);
  console.log(`   Failed lines: ${edgeCases.length}`);
  const successRate = totalLines > 0 ? (100 * (1 - edgeCases.length / totalLines)).toFixed(1) : '0.0';
  console.log(`   Success rate: ${successRate}%`);
}

// CLI interface
if (import.meta.main) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: bun edge-cases-detector.ts <log-file>');
    console.error('       echo "log content" | bun edge-cases-detector.ts --stdin');
    process.exit(1);
  }

  let content: string;
  
  if (args[0] === '--stdin') {
    // Read from stdin
    const chunks: Uint8Array[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    content = Buffer.concat(chunks).toString('utf8');
  } else {
    // Read from file
    try {
      content = readFileSync(args[0], 'utf8');
    } catch (error) {
      console.error('Error reading file:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  const edgeCases = detectEdgeCases(content);
  analyzeEdgeCases(edgeCases);
}