# Deduplino

A CLI tool for deduplicating lino format files by replacing repeated link references with numbered references.

## Installation

```bash
git clone <repository-url>
cd deduplino
bun install
bun run build
```

## Usage

```bash
# Basic usage
./dist/index.js -i input.lino -o output.lino

# From stdin to stdout
echo "(test link)\n(test link)" | ./dist/index.js

# Process 50% most frequent links instead of default 20%
./dist/index.js --deduplication-threshold 0.5 -i input.lino

# Help
./dist/index.js --help
```

## How it works

Deduplino identifies repeated link references and replaces them with numbered references:

### Basic Example

**Input:**
```
(a link that appears multiple times)
(a link that appears multiple times)
(a link that appears multiple times)
```

**Output:**
```
(1: a link that appears multiple times)
1
1
```

### Algorithm

1. **Frequency Analysis**: Counts how often each link appears
2. **Smart Selection**: Only processes the most frequent links (default: top 20%)
3. **Reference Creation**: First occurrence becomes `(N: content)`, subsequent ones become `N`
4. **80/20 Rule**: Process 20% of most frequent links for 80% of the deduplication benefit

### Why the threshold?

The `--deduplication-threshold` parameter (default 0.2 = 20%) ensures:
- **Readability**: Doesn't over-deduplicate less common links
- **Impact**: Focuses on links that appear most often
- **Balance**: Maximum space savings with minimal readability loss

## CLI Options

- `-i, --input`: Input file path (reads from stdin if not provided)
- `-o, --output`: Output file path (writes to stdout if not provided)  
- `--deduplication-threshold`: Percentage of most frequent links to deduplicate (0-1, default: 0.2)

## Examples

```bash
# Deduplicate a file
./dist/index.js -i document.lino -o compressed.lino

# Process from pipeline
cat document.lino | ./dist/index.js > compressed.lino

# Be more aggressive (process top 50% of frequent links)
./dist/index.js --deduplication-threshold 0.5 -i document.lino

# Process all duplicated links
./dist/index.js --deduplication-threshold 1.0 -i document.lino
```

## Development

```bash
# Run tests
bun test

# Build
bun run build

# Development mode
bun run dev
```

## License

MIT
