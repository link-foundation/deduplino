import { Parser, Link, formatLinks } from '@linksplatform/protocols-lino';
import { ParseError } from './errors.js';

interface Pattern {
  type: 'exact' | 'prefix' | 'suffix';
  pattern: string;
  items: string[];
  count: number;
}

/**
 * Converts a Link object to its string representation by flattening nested values.
 * @param link - The Link object to convert
 * @returns String representation of the link
 */
function linkToString(link: Link): string {
  // Simple links with just an id
  if (link.id && (!link.values || link.values.length === 0)) {
    return link.id;
  }

  // Complex links with values - flatten recursively
  const parts: string[] = [];
  const flatten = (l: Link) => {
    if (l.id && !l.values?.length) {
      parts.push(l.id);
    } else if (l.values?.length) {
      // Safe to access since we checked length above
      l.values.forEach(flatten);
    }
  };

  if (link.values?.length) {
    // Safe to access since we checked length above
    link.values.forEach(flatten);
    return parts.join(' ');
  }

  return link.id || '';
}

/**
 * Finds common prefix or suffix pattern between two reference arrays.
 * Ensures at least one reference remains unique to each array.
 * @param references1 - First array of references
 * @param references2 - Second array of references
 * @param type - Type of pattern to find ('prefix' or 'suffix')
 * @returns The common pattern string, or null if no pattern found
 */
function findCommonPattern(references1: string[], references2: string[], type: 'prefix' | 'suffix'): string | null {
  const len1 = references1.length;
  const len2 = references2.length;

  // Need at least 2 references in each to have a meaningful pattern
  // (one for the pattern, one to remain unique)
  const MIN_REFERENCES_FOR_PATTERN = 2;
  if (len1 < MIN_REFERENCES_FOR_PATTERN || len2 < MIN_REFERENCES_FOR_PATTERN) {
    return null;
  }

  let matchLen = 0;

  if (type === 'prefix') {
    // Keep at least one reference different (-1 offset)
    const maxMatch = Math.min(len1 - 1, len2 - 1);
    while (matchLen < maxMatch && references1[matchLen] === references2[matchLen]) {
      matchLen++;
    }
    return matchLen > 0 ? references1.slice(0, matchLen).join(' ') : null;
  } else {
    // Keep at least one reference different (-1 offset)
    const maxMatch = Math.min(len1 - 1, len2 - 1);
    while (matchLen < maxMatch &&
           references1[len1 - 1 - matchLen] === references2[len2 - 1 - matchLen]) {
      matchLen++;
    }
    return matchLen > 0 ? references1.slice(-matchLen).join(' ') : null;
  }
}

/**
 * Identifies deduplication patterns (exact, prefix, and suffix) from an array of links.
 * @param links - Array of Link objects to analyze
 * @returns Array of identified patterns with their frequencies
 */
function findPatterns(links: Link[]): Pattern[] {
  const patterns: Pattern[] = [];

  // Filter links with deduplicatable content (2+ references)
  const validLinks = links.filter(link => {
    const content = linkToString(link);
    return content.split(/\s+/).length >= 2;
  });
  
  // Identify structured links with nested values
  const structuredLinks = validLinks.filter(link => 
    !link.id && link.values?.length > 1 && 
    link.values[0].values?.length > 0
  );
  
  // Count exact duplicates
  const exactCounts = new Map<string, number>();
  validLinks.forEach(link => {
    const key = linkToString(link);
    exactCounts.set(key, (exactCounts.get(key) || 0) + 1);
  });
  
  // Structured duplicates should become prefix patterns
  const structuredDuplicates = new Set(
    structuredLinks
      .map(linkToString)
      .filter(content => (exactCounts.get(content) || 0) >= 2)
  );
  
  // Add exact patterns (excluding structured duplicates)
  exactCounts.forEach((count, content) => {
    if (count >= 2 && !structuredDuplicates.has(content)) {
      patterns.push({
        type: 'exact',
        pattern: content,
        items: [content],
        count
      });
    }
  });
  
  // Maps for prefix and suffix patterns
  const prefixMap = new Map<string, Set<string>>();
  const suffixMap = new Map<string, Set<string>>();
  
  // Handle structured duplicates as prefix patterns
  structuredDuplicates.forEach(content => {
    const matchingLinks = structuredLinks.filter(link => linkToString(link) === content);
    if (matchingLinks.length >= 2 && matchingLinks[0].values?.length > 1) {
      const firstPart = matchingLinks[0].values[0];
      const prefix = linkToString(firstPart);
      
      if (prefix) {
        if (!prefixMap.has(prefix)) {
          prefixMap.set(prefix, new Set());
        }
        matchingLinks.forEach(link => {
          prefixMap.get(prefix)!.add(linkToString(link));
        });
      }
    }
  });
  
  // Find prefix and suffix patterns from non-structured links
  for (let i = 0; i < validLinks.length; i++) {
    if (structuredLinks.includes(validLinks[i])) continue;
    
    for (let j = i + 1; j < validLinks.length; j++) {
      if (structuredLinks.includes(validLinks[j])) continue;
      
      const content1 = linkToString(validLinks[i]);
      const content2 = linkToString(validLinks[j]);
      
      if (content1 === content2) continue;
      
      const references1 = content1.split(/\s+/);
      const references2 = content2.split(/\s+/);
      
      // Check for common prefix
      const prefix = findCommonPattern(references1, references2, 'prefix');
      if (prefix) {
        if (!prefixMap.has(prefix)) {
          prefixMap.set(prefix, new Set());
        }
        prefixMap.get(prefix)!.add(content1);
        prefixMap.get(prefix)!.add(content2);
      }
      
      // Check for common suffix
      const suffix = findCommonPattern(references1, references2, 'suffix');
      if (suffix) {
        if (!suffixMap.has(suffix)) {
          suffixMap.set(suffix, new Set());
        }
        suffixMap.get(suffix)!.add(content1);
        suffixMap.get(suffix)!.add(content2);
      }
    }
  }
  
  // Convert maps to patterns
  const addPatternsFromMap = (map: Map<string, Set<string>>, type: 'prefix' | 'suffix') => {
    map.forEach((items, pattern) => {
      const itemArray = Array.from(items);
      // Calculate total occurrences across all items
      const count = itemArray.reduce((sum, item) =>
        sum + validLinks.filter(link => linkToString(link) === item).length, 0);

      // Only create pattern if it appears at least twice (deduplication requires 2+ occurrences)
      if (count >= 2) {
        patterns.push({
          type,
          pattern,
          items: itemArray,
          count
        });
      }
    });
  };
  
  addPatternsFromMap(prefixMap, 'prefix');
  addPatternsFromMap(suffixMap, 'suffix');
  
  return patterns;
}

/**
 * Selects the best patterns based on scoring and eliminates overlapping patterns.
 * Patterns are scored by frequency × pattern length.
 * @param patterns - Array of patterns to select from
 * @param topPercentage - Percentage of top patterns to select (0-1)
 * @returns Array of non-overlapping patterns sorted by score
 */
function selectBestPatterns(patterns: Pattern[], topPercentage: number): Pattern[] {
  // Sort by score (count * pattern length)
  const sorted = patterns.sort((a, b) => {
    const scoreA = a.count * a.pattern.split(' ').length;
    const scoreB = b.count * b.pattern.split(' ').length;
    return scoreB !== scoreA ? scoreB - scoreA : b.count - a.count;
  });
  
  // Remove overlapping patterns
  const selected: Pattern[] = [];
  const usedItems = new Set<string>();
  
  for (const pattern of sorted) {
    const hasOverlap = pattern.items.some(item => usedItems.has(item));
    
    if (!hasOverlap) {
      selected.push(pattern);
      pattern.items.forEach(item => usedItems.add(item));
      
      // Apply top percentage limit
      if (selected.length >= Math.max(1, Math.ceil(patterns.length * topPercentage))) {
        break;
      }
    }
  }
  
  return selected;
}

/**
 * Creates a reference definition link (e.g., "1: pattern text").
 * @param refId - The numeric reference ID
 * @param references - Array of reference strings that make up the pattern
 * @returns Link object representing the reference definition
 */
function createReference(refId: number, references: string[]): Link {
  const valueLinks = references.map(reference => new Link(reference, []));
  return new Link(refId.toString(), valueLinks);
}

/**
 * Creates a compound link from multiple parts (e.g., "foo 1" for suffix pattern).
 * @param parts - Array of Link objects to combine
 * @returns Link object with null ID and the parts as values
 */
function createCompoundLink(parts: Link[]): Link {
  return new Link(null, parts);
}

/**
 * Applies selected patterns to links, replacing matching content with references.
 * @param links - Original array of links
 * @param patterns - Selected patterns to apply
 * @returns New array of links with patterns applied
 */
function applyPatterns(links: Link[], patterns: Pattern[]): Link[] {
  const replacements = new Map<string, { refId: number; pattern: Pattern }>();
  let nextRefId = 1;
  
  // Assign reference IDs
  patterns.forEach(pattern => {
    pattern.items.forEach(item => {
      replacements.set(item, { refId: nextRefId, pattern });
    });
    nextRefId++;
  });
  
  // Process links
  const result: Link[] = [];
  const definedPatterns = new Set<number>();
  
  for (const link of links) {
    const content = linkToString(link);
    const replacement = replacements.get(content);
    
    if (!replacement) {
      result.push(link);
      continue;
    }
    
    const { refId, pattern } = replacement;
    
    // Define reference if not already defined
    if (!definedPatterns.has(refId)) {
      const references = pattern.pattern.split(/\s+/);
      result.push(createReference(refId, references));
      definedPatterns.add(refId);
    }
    
    // Use the reference
    const refLink = new Link(refId.toString(), []);
    
    if (pattern.type === 'exact') {
      result.push(refLink);
    } else if (pattern.type === 'prefix') {
      const suffix = content.substring(pattern.pattern.length).trim();
      if (suffix) {
        const suffixReferences = suffix.split(/\s+/).map(reference => new Link(reference, []));
        result.push(createCompoundLink([refLink, ...suffixReferences]));
      } else {
        result.push(refLink);
      }
    } else if (pattern.type === 'suffix') {
      const prefix = content.substring(0, content.length - pattern.pattern.length).trim();
      if (prefix) {
        const prefixReferences = prefix.split(/\s+/).map(reference => new Link(reference, []));
        result.push(createCompoundLink([...prefixReferences, refLink]));
      } else {
        result.push(refLink);
      }
    }
  }
  
  return result;
}

/**
 * Attempts to automatically escape input text to make it valid lino format.
 * Uses a multi-pass strategy with increasing aggressiveness.
 * @param input - Raw text input that may not be valid lino format
 * @returns Escaped string that should parse as valid lino format
 */
function autoEscape(input: string): string {
  const parser = new Parser();

  // First, try escaping only references containing colons (like dates, URLs, etc.)
  // Use lookahead/lookbehind instead of word boundaries for better handling of special chars
  let escaped = input.replace(/(?<=^|\s)([^\s'"()]+:[^\s'"()]*)(?=\s|$)/g, "'$1'");
  
  try {
    parser.parse(escaped);
    return escaped; // Success with minimal escaping
  } catch (error) {
    // Second attempt: try escaping references that have problematic characters
    // but preserve already quoted strings and simple references
    const lines = input.split('\n');
    const processedLines = lines.map(line => {
      const references = line.split(/\s+/).filter(reference => reference.length > 0);
      return references.map(reference => {
        // Skip references that are already quoted (including those with trailing punctuation)
        if ((reference.startsWith("'") && (reference.endsWith("'") || /^'.*'[,;.]$/.test(reference))) || 
            (reference.startsWith('"') && (reference.endsWith('"') || /^".*"[,;.]$/.test(reference)))) {
          return reference;
        }
        
        // Skip simple punctuation
        if (/^[(){}[\],]+$/.test(reference)) {
          return reference;
        }
        
        // Escape references with colons, or problematic parentheses combinations
        if (reference.includes(':') || /[()][a-zA-Z]|[a-zA-Z][()]/.test(reference)) {
          return `'${reference}'`;
        }
        
        // Keep simple references as-is
        return reference;
      }).join(' ');
    });
    
    const secondPass = processedLines.join('\n');
    
    try {
      parser.parse(secondPass);
      return secondPass;
    } catch (error2) {
      // Final fallback: escape everything by splitting on whitespace
      return lines.map(line => {
        const references = line.split(/\s+/).filter(reference => reference.length > 0);
        return references.map(reference => {
          // Don't escape references that are already quoted or are simple punctuation
          if (reference.startsWith("'") && reference.endsWith("'")) return reference;
          if (reference.startsWith('"') && reference.endsWith('"')) return reference;
          if (/^[(){}[\],]+$/.test(reference)) return reference;
          
          // Escape everything else
          return `'${reference}'`;
        }).join(' ');
      }).join('\n');
    }
  }
}

export interface DeduplicationResult {
  output: string;
  success: boolean;
  reason?: string;
  patternsApplied: number;
}

/**
 * Main deduplication function that processes lino format text to identify and apply patterns.
 * @param input - Input text in lino format (or raw text if autoEscapeEnabled is true)
 * @param topPercentage - Percentage of top patterns to apply (0-1), default 0.2
 * @param autoEscapeEnabled - Whether to attempt automatic escaping of input, default false
 * @param failOnParseError - Whether to throw ParseError on parsing failure, default false
 * @returns DeduplicationResult with output, success status, and pattern count
 * @throws ParseError if failOnParseError is true and parsing fails
 */
export function deduplicate(input: string, topPercentage: number = 0.2, autoEscapeEnabled: boolean = false, failOnParseError: boolean = false): DeduplicationResult {
  if (!input.trim()) return { output: input, success: false, reason: 'Empty input', patternsApplied: 0 };
  
  let processedInput = input;
  
  // Apply auto-escape if enabled
  if (autoEscapeEnabled) {
    processedInput = autoEscape(input);
  }
  
  // Parse input
  const parser = new Parser();
  let links: Link[];
  
  try {
    links = parser.parse(processedInput);
  } catch (error) {
    if (failOnParseError) {
      throw new ParseError();
    }
    return { output: processedInput, success: false, reason: 'Parsing failed', patternsApplied: 0 };
  }
  
  // Find and apply patterns
  const patterns = findPatterns(links);
  const selectedPatterns = selectBestPatterns(patterns, topPercentage);
  
  // Return formatted version if no patterns selected
  if (selectedPatterns.length === 0) {
    return { output: formatLinks(links, true), success: false, reason: 'No deduplication patterns found', patternsApplied: 0 };
  }
  
  const deduplicatedLinks = applyPatterns(links, selectedPatterns);
  return { output: formatLinks(deduplicatedLinks, true), success: true, patternsApplied: selectedPatterns.length };
}