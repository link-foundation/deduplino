# Deduplino - Lino Deduplication CLI Tool

## Task Description

Create a CLI tool that deduplicates lino format using the npm version of https://github.com/linksplatform/Protocols.Lino

## Deduplication Algorithm

### Basic Example
Input:
```
(this is a link that is duplicated)
(this is a link that is duplicated)
```

Output:
```
(1: this is a link that is duplicated)
1
1
```

### Recursive Deduplication
The tool should work recursively, continuing to find patterns:

Step 1:
```
(1: this is)
1 a link that is duplicated
1 a link that is duplicated
```

Step 2:
```
(1: this is a)
1 link that is duplicated
1 link that is duplicated
```

Continue until longest sequences are grouped together.

## Algorithm Requirements

1. Calculate frequency of each reference
2. Process most frequent references first (80/20 rule - process top 20% most frequent for 80% impact)
3. Replace sequences that appear consecutively with the same frequency
4. Apply recursively to find longer patterns
5. Keep most links readable while maximizing deduplication

## Technical Requirements

- Use npm version of Protocols.Lino
- Use bun.sh ecosystem for faster iteration
- Follow Test Driven Development (TDD)
- Use yargs for CLI interface
- Unit test the deduplication function before building CLI