#!/usr/bin/env bun
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { readFileSync, writeFileSync } from 'fs';
import { deduplicate, DeduplicationResult } from './deduplicator.js';
import { ParseError } from './errors.js';
import { detectEdgeCases, analyzeEdgeCases } from './edge-cases-detector.js';
import { extname, basename } from 'path';

const argv = await yargs(hideBin(process.argv))
  .usage('Usage: $0 [input-file] [options]')
  .positional('input-file', {
    describe: 'Input file path',
    type: 'string'
  })
  .option('input', {
    alias: 'i',
    description: 'Input file path (alternative to positional argument)',
    type: 'string'
  })
  .option('output', {
    alias: 'o',
    description: 'Output file path (if not provided, writes to stdout)',
    type: 'string'
  })
  .option('deduplication-threshold', {
    description: 'Percentage of most frequent links to deduplicate (0-1)',
    type: 'number',
    default: 0.2
  })
  .option('auto-escape', {
    description: 'Automatically escape input to make it valid lino format',
    type: 'boolean',
    default: false
  })
  .option('piped-input', {
    description: 'Read from stdin (use when piping data)',
    type: 'boolean',
    default: false
  })
  .option('fail-on-parse-error', {
    description: 'Exit with code 1 if input cannot be parsed as lino format',
    type: 'boolean',
    default: false
  })
  .option('detect-auto-escape-edge-cases', {
    description: 'Analyze log file line-by-line to find cases that auto-escape cannot fix',
    type: 'boolean',
    default: false
  })
  .example('$0 input.lino', 'Deduplicate input.lino and save to input.deduped.lino')
  .example('$0 input.lino -o output.lino', 'Deduplicate input.lino and save to output.lino')
  .example('$0 -i input.lino -o output.lino', 'Alternative syntax using -i flag')
  .example('$0 --deduplication-threshold 0.5 < input.lino > output.lino', 'Process 50% most frequent links')
  .example('echo "(test)\n(test)" | $0 --piped-input', 'Process from stdin')
  .example('$0 --auto-escape -i log.txt', 'Auto-escape log file to make it valid lino format')
  .example('$0 --fail-on-parse-error -i input.lino', 'Exit with error code 1 if input is invalid lino format')
  .example('$0 --detect-auto-escape-edge-cases -i server.log', 'Find log lines that auto-escape cannot fix')
  .help()
  .argv;

function generateOutputPath(inputPath: string): string {
  const ext = extname(inputPath);
  const base = basename(inputPath, ext);
  const dir = inputPath.substring(0, inputPath.length - basename(inputPath).length);
  
  if (ext === '.lino') {
    return `${dir}${base}.deduped.lino`;
  } else {
    return `${inputPath}.deduped.lino`;
  }
}

async function main() {
  try {
    // Determine input source (positional argument takes precedence)
    const inputFile = argv._[0] as string || argv.input;
    let input: string;
    let outputFile: string | undefined;
    
    if (inputFile) {
      input = readFileSync(inputFile, 'utf8');
      // Generate smart output path if output not specified
      if (!argv.output) {
        outputFile = generateOutputPath(inputFile);
      } else {
        outputFile = argv.output;
      }
    } else if (argv['piped-input']) {
      // Read from stdin
      const chunks: Uint8Array[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      input = Buffer.concat(chunks).toString('utf8');
      outputFile = argv.output; // Could be undefined (stdout)
    } else {
      console.error('Error: No input provided. Use a positional argument, --input to specify a file, or --piped-input to read from stdin.');
      console.error('Run with --help for usage information.');
      process.exit(1);
    }

    // Handle edge case detection mode
    if (argv['detect-auto-escape-edge-cases']) {
      const edgeCases = detectEdgeCases(input);
      analyzeEdgeCases(edgeCases);
      return;
    }

    // Validate deduplication-threshold
    if (argv['deduplication-threshold'] < 0 || argv['deduplication-threshold'] > 1) {
      console.error('Error: deduplication-threshold must be between 0 and 1');
      process.exit(1);
    }

    // Process deduplication
    const result: DeduplicationResult = deduplicate(input, argv['deduplication-threshold'], argv['auto-escape'], argv['fail-on-parse-error']);

    // Write output
    if (outputFile) {
      writeFileSync(outputFile, result.output, 'utf8');
      if (result.success) {
        console.error(`Deduplication complete. Applied ${result.patternsApplied} pattern(s). Output written to ${outputFile}`);
      } else {
        console.error(`\x1b[31mDeduplication failed: ${result.reason}. Original content written to ${outputFile}\x1b[0m`);
      }
    } else {
      process.stdout.write(result.output);
    }
  } catch (error) {
    if (error instanceof ParseError) {
      console.error(error.message);
    } else {
      console.error('Error:', error instanceof Error ? error.message : String(error));
    }
    process.exit(1);
  }
}

main();