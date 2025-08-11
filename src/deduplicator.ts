import { Parser, Link, formatLinks } from '@linksplatform/protocols-lino';

interface Pattern {
  type: 'exact' | 'prefix' | 'suffix';
  pattern: string;
  items: string[];
  count: number;
}

function getLinkContent(link: Link): string {
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
      l.values.forEach(flatten);
    }
  };
  
  if (link.values?.length) {
    link.values.forEach(flatten);
    return parts.join(' ');
  }
  
  return link.id || '';
}

function findCommonPattern(words1: string[], words2: string[], type: 'prefix' | 'suffix'): string | null {
  const len1 = words1.length;
  const len2 = words2.length;
  let matchLen = 0;
  
  if (type === 'prefix') {
    while (matchLen < Math.min(len1 - 1, len2 - 1) && 
           words1[matchLen] === words2[matchLen]) {
      matchLen++;
    }
    return matchLen > 0 ? words1.slice(0, matchLen).join(' ') : null;
  } else {
    while (matchLen < Math.min(len1 - 1, len2 - 1) &&
           words1[len1 - 1 - matchLen] === words2[len2 - 1 - matchLen]) {
      matchLen++;
    }
    return matchLen > 0 ? words1.slice(-matchLen).join(' ') : null;
  }
}

function findPatterns(links: Link[]): Pattern[] {
  const patterns: Pattern[] = [];
  
  // Filter links with deduplicatable content (2+ words)
  const validLinks = links.filter(link => {
    const content = getLinkContent(link);
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
    const key = getLinkContent(link);
    exactCounts.set(key, (exactCounts.get(key) || 0) + 1);
  });
  
  // Structured duplicates should become prefix patterns
  const structuredDuplicates = new Set(
    structuredLinks
      .map(getLinkContent)
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
    const matchingLinks = structuredLinks.filter(link => getLinkContent(link) === content);
    if (matchingLinks.length >= 2 && matchingLinks[0].values?.length > 1) {
      const firstPart = matchingLinks[0].values[0];
      const prefix = getLinkContent(firstPart);
      
      if (prefix) {
        if (!prefixMap.has(prefix)) {
          prefixMap.set(prefix, new Set());
        }
        matchingLinks.forEach(link => {
          prefixMap.get(prefix)!.add(getLinkContent(link));
        });
      }
    }
  });
  
  // Find prefix and suffix patterns from non-structured links
  for (let i = 0; i < validLinks.length; i++) {
    if (structuredLinks.includes(validLinks[i])) continue;
    
    for (let j = i + 1; j < validLinks.length; j++) {
      if (structuredLinks.includes(validLinks[j])) continue;
      
      const content1 = getLinkContent(validLinks[i]);
      const content2 = getLinkContent(validLinks[j]);
      
      if (content1 === content2) continue;
      
      const words1 = content1.split(/\s+/);
      const words2 = content2.split(/\s+/);
      
      // Check for common prefix
      const prefix = findCommonPattern(words1, words2, 'prefix');
      if (prefix) {
        if (!prefixMap.has(prefix)) {
          prefixMap.set(prefix, new Set());
        }
        prefixMap.get(prefix)!.add(content1);
        prefixMap.get(prefix)!.add(content2);
      }
      
      // Check for common suffix
      const suffix = findCommonPattern(words1, words2, 'suffix');
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
      if (items.size >= 1) {  // For structured duplicates, even 1 unique item counts
        const itemArray = Array.from(items);
        patterns.push({
          type,
          pattern,
          items: itemArray,
          count: itemArray.reduce((sum, item) => 
            sum + validLinks.filter(link => getLinkContent(link) === item).length, 0)
        });
      }
    });
  };
  
  addPatternsFromMap(prefixMap, 'prefix');
  addPatternsFromMap(suffixMap, 'suffix');
  
  return patterns;
}

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

function createReference(refId: number, words: string[]): Link {
  const valueLinks = words.map(w => new Link(w, []));
  return new Link(refId.toString(), valueLinks);
}

function createCompoundLink(parts: Link[]): Link {
  return new Link(null, parts);
}

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
    const content = getLinkContent(link);
    const replacement = replacements.get(content);
    
    if (!replacement) {
      result.push(link);
      continue;
    }
    
    const { refId, pattern } = replacement;
    
    // Define reference if not already defined
    if (!definedPatterns.has(refId)) {
      const words = pattern.pattern.split(/\s+/);
      result.push(createReference(refId, words));
      definedPatterns.add(refId);
    }
    
    // Use the reference
    const refLink = new Link(refId.toString(), []);
    
    if (pattern.type === 'exact') {
      result.push(refLink);
    } else if (pattern.type === 'prefix') {
      const suffix = content.substring(pattern.pattern.length).trim();
      if (suffix) {
        const suffixLinks = suffix.split(/\s+/).map(w => new Link(w, []));
        result.push(createCompoundLink([refLink, ...suffixLinks]));
      } else {
        result.push(refLink);
      }
    } else if (pattern.type === 'suffix') {
      const prefix = content.substring(0, content.length - pattern.pattern.length).trim();
      if (prefix) {
        const prefixLinks = prefix.split(/\s+/).map(w => new Link(w, []));
        result.push(createCompoundLink([...prefixLinks, refLink]));
      } else {
        result.push(refLink);
      }
    }
  }
  
  return result;
}

function autoEscape(input: string): string {
  const parser = new Parser();
  
  // First, try escaping only words containing colons (like dates, URLs, etc.)
  let escaped = input.replace(/\b([^\s'"()]+:[^\s'"()]*)\b/g, "'$1'");
  
  try {
    parser.parse(escaped);
    return escaped; // Success with minimal escaping
  } catch (error) {
    // Second attempt: try escaping tokens that have problematic characters
    // but preserve already quoted strings and simple tokens
    const lines = input.split('\n');
    const processedLines = lines.map(line => {
      const tokens = line.split(/\s+/).filter(token => token.length > 0);
      return tokens.map(token => {
        // Skip tokens that are already quoted
        if ((token.startsWith("'") && token.endsWith("'")) || 
            (token.startsWith('"') && token.endsWith('"'))) {
          return token;
        }
        
        // Skip simple punctuation
        if (/^[(){}[\],]+$/.test(token)) {
          return token;
        }
        
        // Escape tokens with colons, or problematic parentheses combinations
        if (token.includes(':') || /[()][a-zA-Z]|[a-zA-Z][()]/.test(token)) {
          return `'${token}'`;
        }
        
        // Keep simple tokens as-is
        return token;
      }).join(' ');
    });
    
    const secondPass = processedLines.join('\n');
    
    try {
      parser.parse(secondPass);
      return secondPass;
    } catch (error2) {
      // Final fallback: escape everything by splitting on whitespace
      return lines.map(line => {
        const tokens = line.split(/\s+/).filter(token => token.length > 0);
        return tokens.map(token => {
          // Don't escape tokens that are already quoted or are simple punctuation
          if (token.startsWith("'") && token.endsWith("'")) return token;
          if (token.startsWith('"') && token.endsWith('"')) return token;
          if (/^[(){}[\],]+$/.test(token)) return token;
          
          // Escape everything else
          return `'${token}'`;
        }).join(' ');
      }).join('\n');
    }
  }
}

export function deduplicate(input: string, topPercentage: number = 0.2, autoEscapeEnabled: boolean = false): string {
  if (!input.trim()) return input;
  
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
    return processedInput; // Return processed input if parsing fails
  }
  
  // Find and apply patterns
  const patterns = findPatterns(links);
  const selectedPatterns = selectBestPatterns(patterns, topPercentage);
  
  // Return formatted version if no patterns selected
  if (selectedPatterns.length === 0) {
    return formatLinks(links, true);
  }
  
  const deduplicatedLinks = applyPatterns(links, selectedPatterns);
  return formatLinks(deduplicatedLinks, true);
}