# Deduplino

A CLI tool for deduplicating [lino format](https://github.com/linksplatform/Protocols.Lino) files by identifying patterns in repeated link references and replacing them with numbered references for improved readability and reduced file size.

## Installation

### Using Bun (Recommended)

```bash
# Install globally with bun
bun install -g deduplino

# Or from source
git clone <repository-url>
cd deduplino
bun install
bun run build
```

### Using NPM (Fallback)

```bash
npm install -g deduplino
```

## Quick Start

```bash
# Basic usage
deduplino -i input.lino -o output.lino

# From stdin to stdout
echo "(test link)\n(test link)" | deduplino

# Process with different threshold
deduplino --deduplication-threshold 0.5 -i input.lino
```

## How It Works

Deduplino analyzes lino files to find patterns in link references and creates optimized representations using three pattern types:

### 1. Exact Duplicates
Links that appear identically multiple times.

**Input:**
```
(first second)
(first second)
(first second)
```

**Output:**
```
1: first second
1
1
1
```

### 2. Prefix Patterns
Links that share common beginnings.

**Input:**
```
(this is a link of cat)
(this is a link of tree)
```

**Output:**
```
1: this is a link of
1 cat
1 tree
```

### 3. Suffix Patterns
Links that share common endings.

**Input:**
```
(foo ends here)
(bar ends here)
```

**Output:**
```
1: ends here
foo 1
bar 1
```

### Advanced Pattern Detection

The tool handles complex nested structures and can identify patterns in structured links:

**Input:**
```
(this is) a link
(this is) a link
```

**Output:**
```
1: this is
1 a link
1 a link
```

## Algorithm

1. **Parse** input using the Protocols.Lino parser
2. **Filter** links with 2+ words (deduplicatable content)
3. **Identify Patterns**:
   - Exact duplicates
   - Common prefixes between link pairs
   - Common suffixes between link pairs
   - Special handling for structured links
4. **Score & Select** patterns by (frequency × pattern_length)
5. **Apply** top patterns based on threshold
6. **Format** output using library's formatLinks function

## CLI Options

| Option | Short | Description | Default |
|--------|--------|-------------|---------|
| `--input` | `-i` | Input file path (stdin if not provided) | - |
| `--output` | `-o` | Output file path (stdout if not provided) | - |
| `--deduplication-threshold` | `-p` | Percentage of patterns to apply (0-1) | 0.2 |
| `--help` | `-h` | Show help information | - |

## Examples

### Basic File Processing
```bash
# Deduplicate a file
deduplino -i document.lino -o compressed.lino

# Process from pipeline
cat document.lino | deduplino > compressed.lino
```

### Threshold Control
```bash
# Conservative (default) - top 20% of patterns
deduplino -i document.lino

# More aggressive - top 50% of patterns
deduplino --deduplication-threshold 0.5 -i document.lino

# Maximum deduplication - all patterns
deduplino --deduplication-threshold 1.0 -i document.lino
```

### Pipeline Usage
```bash
# Chain with other tools
some-tool | deduplino | other-tool

# Multiple processing steps
cat input.lino | deduplino -p 0.3 | tee intermediate.lino | final-processor
```

## Pattern Selection Strategy

The `--deduplication-threshold` parameter controls which patterns are applied:

- **0.2 (default)**: Apply top 20% of patterns for optimal readability/compression balance
- **0.5**: More aggressive deduplication, may impact readability
- **1.0**: Maximum deduplication, applies all found patterns

Patterns are ranked by: `frequency × pattern_length`

## Development

### Setup
```bash
bun install
```

### Testing
```bash
# Run all tests
bun test

# Watch mode
bun test --watch
```

### Building
```bash
# Build for production
bun run build

# Development mode with file watching
bun run dev
```

### Project Structure
```
src/
├── index.ts          # CLI interface and argument parsing
├── deduplicator.ts   # Core deduplication algorithm
tests/
└── deduplicator.test.ts  # Comprehensive test suite (27 tests)
```

## Algorithm Details

### Pattern Finding
- **Exact**: Map-based counting of identical content
- **Prefix/Suffix**: Pairwise comparison with word-level matching
- **Structured**: Special handling for nested link structures like `(this is) a link`

### Pattern Scoring
Patterns are scored by `count × pattern.split(' ').length` to favor:
- High-frequency patterns (appear many times)  
- Longer patterns (more compression benefit)

### Overlap Prevention
Selected patterns are filtered to prevent overlap - each link content can only be part of one pattern.

## Dependencies

- **[@linksplatform/protocols-lino](https://www.npmjs.com/package/@linksplatform/protocols-lino)**: Lino format parsing and formatting
- **[yargs](https://www.npmjs.com/package/yargs)**: Command-line argument parsing

## License

This is free and unencumbered software released into the **public domain**.

See [LICENSE](./LICENSE) for full details or visit <https://unlicense.org>

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass: `bun test`
5. Submit a pull request

## Links

- [Lino Protocol Specification](https://github.com/linksplatform/Protocols.Lino)
- [NPM Package](https://www.npmjs.com/package/deduplino)