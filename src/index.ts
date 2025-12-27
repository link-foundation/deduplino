#!/usr/bin/env node
import { makeConfig } from 'lino-arguments';
import { readFileSync, writeFileSync } from 'fs';
import { deduplicate, DeduplicationResult } from './deduplicator.js';
import { ParseError } from './errors.js';
import { detectEdgeCases, analyzeEdgeCases } from './edge-cases-detector.js';
import { extname, basename } from 'path';

const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs
      .usage('Usage: $0 [input-file] [options]')
      .command('$0 [input-file]', 'Deduplicate lino format files', (yargs) => {
        return yargs.positional('input-file', {
          describe: 'Input file path',
          type: 'string'
        });
      })
      .option('input', {
        alias: 'i',
        description: 'Input file path (alternative to positional argument)',
        type: 'string',
        default: getenv('INPUT', '')
      })
      .option('output', {
        alias: 'o',
        description: 'Output file path (if not provided, writes to stdout)',
        type: 'string',
        default: getenv('OUTPUT', '')
      })
      .option('deduplication-threshold', {
        description: 'Percentage of most frequent links to deduplicate (0-1)',
        type: 'number',
        default: getenv('DEDUPLICATION_THRESHOLD', 0.2)
      })
      .option('auto-escape', {
        description: 'Automatically escape input to make it valid lino format',
        type: 'boolean',
        default: getenv('AUTO_ESCAPE', false)
      })
      .option('piped-input', {
        description: 'Read from stdin (use when piping data)',
        type: 'boolean',
        default: getenv('PIPED_INPUT', false)
      })
      .option('fail-on-parse-error', {
        description: 'Exit with code 1 if input cannot be parsed as lino format',
        type: 'boolean',
        default: getenv('FAIL_ON_PARSE_ERROR', false)
      })
      .option('detect-auto-escape-edge-cases', {
        description: 'Analyze log file line-by-line to find cases that auto-escape cannot fix',
        type: 'boolean',
        default: false
      })
      .example('$0 input.lino', 'Deduplicate input.lino and save to input.deduped.lino')
      .example('$0 input.lino -o output.lino', 'Deduplicate input.lino and save to output.lino')
      .example('$0 -i input.lino -o output.lino', 'Alternative syntax using -i flag')
      .example('$0 --piped-input --deduplication-threshold 0.5 < input.lino > output.lino', 'Process 50% most frequent links from stdin')
      .example('echo "(test)\n(test)" | $0 --piped-input', 'Process from stdin')
      .example('$0 --auto-escape -i log.txt', 'Auto-escape log file to make it valid lino format')
      .example('$0 --fail-on-parse-error -i input.lino', 'Exit with error code 1 if input is invalid lino format')
      .example('$0 --detect-auto-escape-edge-cases -i server.log', 'Find log lines that auto-escape cannot fix')
      .help()
});

/**
 * Generates a smart output path based on the input file path.
 * Validates and sanitizes the path to prevent path traversal issues.
 * @param inputPath - Input file path
 * @returns Generated output path with .deduped.lino extension
 * @throws Error if input path is invalid
 */
function generateOutputPath(inputPath: string): string {
  // Validate input
  if (!inputPath || inputPath.trim().length === 0) {
    throw new Error('Invalid input path: path cannot be empty');
  }

  // Check for path traversal attempts
  if (inputPath.includes('..')) {
    throw new Error('Invalid input path: path traversal not allowed');
  }

  const ext = extname(inputPath);
  const base = basename(inputPath, ext);
  const dir = inputPath.substring(0, inputPath.length - basename(inputPath).length);

  // Handle edge cases
  if (base.length === 0) {
    throw new Error('Invalid input path: filename cannot be empty');
  }

  if (ext === '.lino') {
    return `${dir}${base}.deduped.lino`;
  } else {
    return `${inputPath}.deduped.lino`;
  }
}

/**
 * Main CLI function that handles argument parsing, input reading, and output writing.
 */
async function main() {
  try {
    // Input size limit (10MB default) for security
    const MAX_INPUT_SIZE = 10 * 1024 * 1024; // 10MB

    // Determine input source (positional argument takes precedence)
    // lino-arguments converts kebab-case to camelCase (input-file -> inputFile)
    const inputFile = (config.inputFile as string) || (config.input as string);
    let input: string;
    let outputFile: string | undefined;

    if (inputFile) {
      try {
        input = readFileSync(inputFile, 'utf8');
        if (input.length > MAX_INPUT_SIZE) {
          console.error(`Error: Input file exceeds maximum size limit of ${MAX_INPUT_SIZE / 1024 / 1024}MB`);
          process.exit(1);
        }
      } catch (error) {
        if (error instanceof Error) {
          if ('code' in error && error.code === 'ENOENT') {
            console.error(`Error: Input file '${inputFile}' not found`);
          } else if ('code' in error && error.code === 'EACCES') {
            console.error(`Error: Permission denied reading '${inputFile}'`);
          } else {
            console.error(`Error reading file '${inputFile}': ${error.message}`);
          }
        } else {
          console.error(`Error reading file '${inputFile}': ${String(error)}`);
        }
        process.exit(1);
      }

      // Generate smart output path if output not specified
      if (!config.output) {
        outputFile = generateOutputPath(inputFile);
      } else {
        outputFile = config.output as string;
      }
    } else if (config.pipedInput) {
      // Read from stdin with error handling
      const chunks: Uint8Array[] = [];
      try {
        let totalSize = 0;
        for await (const chunk of process.stdin) {
          totalSize += chunk.length;
          if (totalSize > MAX_INPUT_SIZE) {
            console.error(`Error: Input exceeds maximum size limit of ${MAX_INPUT_SIZE / 1024 / 1024}MB`);
            process.exit(1);
          }
          chunks.push(chunk);
        }
        input = Buffer.concat(chunks).toString('utf8');
      } catch (error) {
        console.error(`Error reading from stdin: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
      outputFile = config.output as string | undefined; // Could be undefined (stdout)
    } else {
      console.error('Error: No input provided.');
      console.error('');
      console.error('Usage:');
      console.error('  deduplino <input-file> [options]        # Process a file');
      console.error('  deduplino -i <file> [options]           # Alternative syntax');
      console.error('  cat file | deduplino --piped-input      # Read from stdin');
      console.error('');
      console.error('Run with --help for full usage information.');
      process.exit(1);
    }

    // Handle edge case detection mode (no threshold validation needed)
    if (config.detectAutoEscapeEdgeCases) {
      const edgeCases = detectEdgeCases(input);
      analyzeEdgeCases(edgeCases);
      return;
    }

    // Validate deduplication-threshold (only when actually deduplicating)
    const threshold = config.deduplicationThreshold as number;
    if (threshold < 0 || threshold > 1) {
      console.error('Error: --deduplication-threshold must be between 0 and 1');
      console.error(`Received: ${threshold}`);
      process.exit(1);
    }

    // Process deduplication
    const result: DeduplicationResult = deduplicate(input, threshold, config.autoEscape as boolean, config.failOnParseError as boolean);

    // Write output
    if (outputFile) {
      try {
        writeFileSync(outputFile, result.output, 'utf8');
        // Use stderr for status messages (stdout is for actual output)
        if (result.success) {
          console.error(`✓ Deduplication complete. Applied ${result.patternsApplied} pattern(s). Output written to ${outputFile}`);
        } else {
          console.error(`⚠ Deduplication failed: ${result.reason}. Original content written to ${outputFile}`);
        }
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'EACCES') {
          console.error(`Error: Permission denied writing to '${outputFile}'`);
        } else {
          console.error(`Error writing to '${outputFile}': ${error instanceof Error ? error.message : String(error)}`);
        }
        process.exit(1);
      }
    } else {
      // Writing to stdout - only output the result, no status messages
      process.stdout.write(result.output);
    }
  } catch (error) {
    // Standardized error handling
    if (error instanceof ParseError) {
      console.error(`Parse Error: ${error.message}`);
      console.error('Tip: Try using --auto-escape to automatically fix common formatting issues');
    } else if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error(`Error: ${String(error)}`);
    }
    process.exit(1);
  }
}

main();