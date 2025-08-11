import { Parser, Link } from '@linksplatform/protocols-lino';

interface Pattern {
  type: 'exact' | 'prefix' | 'suffix';
  pattern: string;
  items: string[];
  count: number;
}

function getLinkContent(link: Link): string {
  // For simple links with just an id
  if (link.id && (!link.values || link.values.length === 0)) {
    return link.id;
  }
  
  // For complex links with values, flatten them into a string
  if (link.values && link.values.length > 0) {
    const parts: string[] = [];
    
    // Recursively get content from nested structures
    const flatten = (l: Link) => {
      if (l.id && !l.values.length) {
        parts.push(l.id);
      } else if (l.values && l.values.length > 0) {
        for (const val of l.values) {
          flatten(val);
        }
      }
    };
    
    for (const val of link.values) {
      flatten(val);
    }
    
    return parts.join(' ');
  }
  
  return link.id || '';
}

function findPatterns(links: Link[]): Pattern[] {
  const patterns: Pattern[] = [];
  
  // Filter links that have content that can be deduplicated
  const validLinks = links.filter(link => {
    const content = getLinkContent(link);
    const words = content.split(/\s+/);
    return words.length >= 2;
  });
  
  // Special handling for links with nested structure like "(this is) a link"
  // These should be treated as prefix patterns, not exact duplicates
  const structuredLinks = validLinks.filter(link => 
    !link.id && link.values && link.values.length > 1 && 
    link.values[0].values && link.values[0].values.length > 0
  );
  
  // Find exact duplicates
  const exactCounts = new Map<string, number>();
  for (const link of validLinks) {
    const key = getLinkContent(link);
    exactCounts.set(key, (exactCounts.get(key) || 0) + 1);
  }
  
  // For structured links with duplicates, convert them to prefix patterns instead of exact
  const structuredDuplicates = new Set<string>();
  for (const link of structuredLinks) {
    const content = getLinkContent(link);
    if (exactCounts.get(content) >= 2) {
      structuredDuplicates.add(content);
    }
  }
  
  for (const [content, count] of exactCounts) {
    if (count >= 2 && !structuredDuplicates.has(content)) {
      patterns.push({
        type: 'exact',
        pattern: content,
        items: [content],
        count
      });
    }
  }
  
  // Find prefix patterns
  const prefixMap = new Map<string, Set<string>>();
  
  // Handle structured links with duplicates as prefix patterns
  // When we have "(this is) a link" appearing multiple times, treat "this is" as the prefix
  for (const content of structuredDuplicates) {
    // Find all structured links with this content
    const matchingLinks = structuredLinks.filter(link => getLinkContent(link) === content);
    
    if (matchingLinks.length >= 2 && matchingLinks[0].values.length > 1) {
      // Get the prefix from the first nested part
      const firstPart = matchingLinks[0].values[0];
      const prefixParts: string[] = [];
      
      const collectPrefix = (v: Link) => {
        if (v.id && !v.values.length) {
          prefixParts.push(v.id);
        } else if (v.values) {
          for (const subVal of v.values) {
            collectPrefix(subVal);
          }
        }
      };
      
      if (firstPart.values && firstPart.values.length > 0) {
        collectPrefix(firstPart);
        const prefix = prefixParts.join(' ');
        
        // Add this as a prefix pattern
        if (!prefixMap.has(prefix)) {
          prefixMap.set(prefix, new Set());
        }
        
        // Add all matching content to this prefix pattern
        for (const link of matchingLinks) {
          prefixMap.get(prefix)!.add(getLinkContent(link));
        }
      }
    }
  }
  
  // Find prefix patterns
  for (let i = 0; i < validLinks.length; i++) {
    // Skip structured links as they're already handled
    if (structuredLinks.includes(validLinks[i])) continue;
    
    for (let j = i + 1; j < validLinks.length; j++) {
      if (structuredLinks.includes(validLinks[j])) continue;
      
      const content1 = getLinkContent(validLinks[i]);
      const content2 = getLinkContent(validLinks[j]);
      
      if (content1 === content2) continue;
      
      const words1 = content1.split(/\s+/);
      const words2 = content2.split(/\s+/);
      
      // Find common prefix
      let prefixLen = 0;
      while (prefixLen < Math.min(words1.length - 1, words2.length - 1) &&
             words1[prefixLen] === words2[prefixLen]) {
        prefixLen++;
      }
      
      if (prefixLen > 0) {
        const prefix = words1.slice(0, prefixLen).join(' ');
        if (!prefixMap.has(prefix)) {
          prefixMap.set(prefix, new Set());
        }
        prefixMap.get(prefix)!.add(content1);
        prefixMap.get(prefix)!.add(content2);
      }
    }
  }
  
  // Process all collected prefix patterns
  for (const [prefix, items] of prefixMap) {
    // For structured duplicates, we always want to create the pattern
    // even if there's only one unique item (since it appears multiple times)
    if (items.size >= 1) {
      patterns.push({
        type: 'prefix',
        pattern: prefix,
        items: Array.from(items),
        count: Array.from(items).reduce((sum, item) => {
          // Count how many times this exact content appears
          return sum + validLinks.filter(link => getLinkContent(link) === item).length;
        }, 0)
      });
    }
  }
  
  // Find suffix patterns
  const suffixMap = new Map<string, Set<string>>();
  
  for (let i = 0; i < validLinks.length; i++) {
    for (let j = i + 1; j < validLinks.length; j++) {
      const content1 = getLinkContent(validLinks[i]);
      const content2 = getLinkContent(validLinks[j]);
      
      if (content1 === content2) continue;
      
      const words1 = content1.split(/\s+/);
      const words2 = content2.split(/\s+/);
      
      // Find common suffix
      let suffixLen = 0;
      const len1 = words1.length;
      const len2 = words2.length;
      
      while (suffixLen < Math.min(len1 - 1, len2 - 1) &&
             words1[len1 - 1 - suffixLen] === words2[len2 - 1 - suffixLen]) {
        suffixLen++;
      }
      
      if (suffixLen > 0) {
        const suffix = words1.slice(-suffixLen).join(' ');
        if (!suffixMap.has(suffix)) {
          suffixMap.set(suffix, new Set());
        }
        suffixMap.get(suffix)!.add(content1);
        suffixMap.get(suffix)!.add(content2);
      }
    }
  }
  
  for (const [suffix, items] of suffixMap) {
    if (items.size >= 2) {
      patterns.push({
        type: 'suffix',
        pattern: suffix,
        items: Array.from(items),
        count: items.size
      });
    }
  }
  
  return patterns;
}

function selectBestPatterns(patterns: Pattern[], topPercentage: number): Pattern[] {
  // Sort patterns by score (count * pattern length)
  const sorted = patterns.sort((a, b) => {
    const scoreA = a.count * a.pattern.split(' ').length;
    const scoreB = b.count * b.pattern.split(' ').length;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return b.count - a.count;
  });
  
  // Remove overlapping patterns
  const selected: Pattern[] = [];
  const usedItems = new Set<string>();
  
  for (const pattern of sorted) {
    // Check if any items are already used
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

function applyPatterns(links: Link[], patterns: Pattern[]): Link[] {
  const replacements = new Map<string, { refId: number; pattern: Pattern }>();
  let nextRefId = 1;
  
  // Assign reference IDs
  for (const pattern of patterns) {
    for (const item of pattern.items) {
      replacements.set(item, { refId: nextRefId, pattern });
    }
    nextRefId++;
  }
  
  // Process links
  const result: Link[] = [];
  const definedPatterns = new Set<number>();
  
  for (const link of links) {
    const content = getLinkContent(link);
    
    if (replacements.has(content)) {
      const { refId, pattern } = replacements.get(content)!;
      
      if (pattern.type === 'exact') {
        if (!definedPatterns.has(refId)) {
          // Define the reference - use values array instead of id with colon
          result.push(new Link(refId.toString(), [new Link(content, [])]));
          definedPatterns.add(refId);
        }
        // Use the reference
        result.push(new Link(refId.toString(), []));
      } else if (pattern.type === 'prefix') {
        const suffix = content.substring(pattern.pattern.length).trim();
        if (!definedPatterns.has(refId)) {
          // Define the reference for prefix
          result.push(new Link(refId.toString(), [new Link(pattern.pattern, [])]));
          definedPatterns.add(refId);
        }
        // Use the reference with suffix
        if (suffix) {
          // Create a compound link with reference and suffix
          const suffixWords = suffix.split(/\s+/);
          const refLink = new Link(refId.toString(), []);
          const valueLinks = suffixWords.map(w => new Link(w, []));
          result.push(new Link(null, [refLink, ...valueLinks]));
        } else {
          result.push(new Link(refId.toString(), []));
        }
      } else if (pattern.type === 'suffix') {
        const prefix = content.substring(0, content.length - pattern.pattern.length).trim();
        if (!definedPatterns.has(refId)) {
          // Define the reference for suffix
          result.push(new Link(refId.toString(), [new Link(pattern.pattern, [])]));
          definedPatterns.add(refId);
        }
        // Use the reference with prefix
        if (prefix) {
          // Create a compound link with prefix and reference
          const prefixWords = prefix.split(/\s+/);
          const valueLinks = prefixWords.map(w => new Link(w, []));
          const refLink = new Link(refId.toString(), []);
          result.push(new Link(null, [...valueLinks, refLink]));
        } else {
          result.push(new Link(refId.toString(), []));
        }
      }
    } else {
      // Keep original link
      result.push(link);
    }
  }
  
  return result;
}

function customFormatLinks(links: Link[]): string {
  const result: string[] = [];
  
  for (const link of links) {
    // Check if this is a reference definition (e.g., "1: content")
    if (link.id && link.values.length === 1 && !link.values[0].values.length) {
      // This is a reference definition
      const refId = link.id;
      const content = link.values[0].id || '';
      result.push(`(${refId}: ${content})`);
    } 
    // Check if this is a compound link with reference and suffix/prefix
    else if (!link.id && link.values.length > 0) {
      // Check if it's a deduplicated pattern (starts with a reference number)
      let isDedupPattern = false;
      const parts: string[] = [];
      
      for (const val of link.values) {
        if (val.id && !val.values.length) {
          // Check if first value is a reference number
          if (parts.length === 0 && /^\d+$/.test(val.id)) {
            isDedupPattern = true;
          }
          parts.push(val.id);
        } else if (val.values && val.values.length > 0) {
          // Handle nested structures (like "(this is)")
          const nestedParts: string[] = [];
          const collectNested = (v: Link) => {
            if (v.id && !v.values.length) {
              nestedParts.push(v.id);
            } else if (v.values) {
              for (const subVal of v.values) {
                collectNested(subVal);
              }
            }
          };
          collectNested(val);
          
          // For non-deduplicated nested content, preserve parentheses
          if (!isDedupPattern && nestedParts.length > 0) {
            parts.push(`(${nestedParts.join(' ')})`);
          } else {
            parts.push(...nestedParts);
          }
        }
      }
      
      if (isDedupPattern || parts.some(p => /^\d+$/.test(p))) {
        // For deduplicated patterns or patterns containing references, just join without extra parentheses
        result.push(parts.join(' '));
      } else if (parts.length > 0) {
        // For non-deduplicated multi-word links, add parentheses
        result.push(`(${parts.join(' ')})`);
      } else {
        // Fall back to standard formatting
        result.push(link.format(false));
      }
    }
    // Check if this is just a reference usage
    else if (link.id && !link.values.length && /^\d+$/.test(link.id)) {
      result.push(link.id);
    }
    // Default: preserve parentheses for non-deduplicated links
    else {
      // For simple links with just an id, add parentheses
      if (link.id && !link.values.length) {
        result.push(`(${link.id})`);
      } else {
        result.push(link.format(false));
      }
    }
  }
  
  return result.join('\n');
}

export function deduplicate(input: string, topPercentage: number = 0.2): string {
  if (!input.trim()) return input;
  
  // Parse input using the lino parser
  const parser = new Parser();
  let links: Link[];
  
  try {
    links = parser.parse(input);
  } catch (error) {
    // If parsing fails, return original input
    return input;
  }
  
  // Find and apply patterns
  const patterns = findPatterns(links);
  const selectedPatterns = selectBestPatterns(patterns, topPercentage);
  
  // Check if patterns are found but not selected
  if (selectedPatterns.length === 0) {
    // Check if we have structured links that should be deduplicated
    const hasStructuredDuplicates = links.filter(link => 
      !link.id && link.values && link.values.length > 1 && 
      link.values[0].values && link.values[0].values.length > 0
    ).length >= 2;
    
    if (hasStructuredDuplicates) {
      // Return formatted version
      return customFormatLinks(links);
    }
    return input;
  }
  
  const deduplicatedLinks = applyPatterns(links, selectedPatterns);
  
  // Use custom formatter for the expected output format
  return customFormatLinks(deduplicatedLinks);
}