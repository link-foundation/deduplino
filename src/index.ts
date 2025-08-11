#!/usr/bin/env bun
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { readFileSync, writeFileSync } from 'fs';
import { deduplicate } from './deduplicator.js';

const argv = await yargs(hideBin(process.argv))
  .usage('Usage: $0 [options]')
  .option('input', {
    alias: 'i',
    description: 'Input file path (if not provided, reads from stdin)',
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
  .example('$0 -i input.lino -o output.lino', 'Deduplicate input.lino and save to output.lino')
  .example('$0 --deduplication-threshold 0.5 < input.lino > output.lino', 'Process 50% most frequent links')
  .example('echo "(test)\n(test)" | $0', 'Process from stdin')
  .example('$0 --auto-escape -i log.txt', 'Auto-escape log file to make it valid lino format')
  .help()
  .argv;

async function main() {
  try {
    // Read input
    let input: string;
    if (argv.input) {
      input = readFileSync(argv.input, 'utf8');
    } else {
      // Read from stdin
      const chunks: Uint8Array[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      input = Buffer.concat(chunks).toString('utf8');
    }

    // Validate deduplication-threshold
    if (argv['deduplication-threshold'] < 0 || argv['deduplication-threshold'] > 1) {
      console.error('Error: deduplication-threshold must be between 0 and 1');
      process.exit(1);
    }

    // Process deduplication
    const result = deduplicate(input, argv['deduplication-threshold'], argv['auto-escape']);

    // Write output
    if (argv.output) {
      writeFileSync(argv.output, result, 'utf8');
      console.error(`Deduplication complete. Output written to ${argv.output}`);
    } else {
      process.stdout.write(result);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();