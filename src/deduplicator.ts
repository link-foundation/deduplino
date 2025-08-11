interface Token {
  content: string;
  type: 'link' | 'text';
  words?: string[];
}

interface Pattern {
  type: 'exact' | 'prefix' | 'suffix';
  pattern: string;
  items: string[];
  count: number;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let current = '';
  let inLink = false;
  
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    
    if (char === '(' && !inLink) {
      if (current) {
        tokens.push({ content: current, type: 'text' });
        current = '';
      }
      inLink = true;
      current = char;
    } else if (char === ')' && inLink) {
      current += char;
      const inner = current.slice(1, -1).trim();
      const words = inner.split(/\s+/);
      tokens.push({ 
        content: current, 
        type: 'link',
        words: words.length >= 2 ? words : undefined
      });
      current = '';
      inLink = false;
    } else {
      current += char;
    }
  }
  
  if (current) {
    tokens.push({ content: current, type: inLink ? 'text' : 'text' });
  }
  
  return tokens;
}

function findPatterns(tokens: Token[]): Pattern[] {
  const patterns: Pattern[] = [];
  const linkTokens = tokens.filter(t => t.type === 'link' && t.words);
  
  // Find exact duplicates
  const exactCounts = new Map<string, number>();
  for (const token of linkTokens) {
    const key = token.content;
    exactCounts.set(key, (exactCounts.get(key) || 0) + 1);
  }
  
  for (const [content, count] of exactCounts) {
    if (count >= 2) {
      patterns.push({
        type: 'exact',
        pattern: content.slice(1, -1),
        items: [content.slice(1, -1)],
        count
      });
    }
  }
  
  // Find prefix patterns
  const prefixMap = new Map<string, Set<string>>();
  
  for (let i = 0; i < linkTokens.length; i++) {
    for (let j = i + 1; j < linkTokens.length; j++) {
      const words1 = linkTokens[i].words!;
      const words2 = linkTokens[j].words!;
      
      if (linkTokens[i].content === linkTokens[j].content) continue;
      
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
        prefixMap.get(prefix)!.add(linkTokens[i].content.slice(1, -1));
        prefixMap.get(prefix)!.add(linkTokens[j].content.slice(1, -1));
      }
    }
  }
  
  for (const [prefix, items] of prefixMap) {
    if (items.size >= 2) {
      patterns.push({
        type: 'prefix',
        pattern: prefix,
        items: Array.from(items),
        count: items.size
      });
    }
  }
  
  // Find suffix patterns
  const suffixMap = new Map<string, Set<string>>();
  
  for (let i = 0; i < linkTokens.length; i++) {
    for (let j = i + 1; j < linkTokens.length; j++) {
      const words1 = linkTokens[i].words!;
      const words2 = linkTokens[j].words!;
      
      if (linkTokens[i].content === linkTokens[j].content) continue;
      
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
        suffixMap.get(suffix)!.add(linkTokens[i].content.slice(1, -1));
        suffixMap.get(suffix)!.add(linkTokens[j].content.slice(1, -1));
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

function applyPatterns(tokens: Token[], patterns: Pattern[]): string {
  const replacements = new Map<string, { refId: number; pattern: Pattern }>();
  let nextRefId = 1;
  
  // Assign reference IDs
  for (const pattern of patterns) {
    for (const item of pattern.items) {
      replacements.set(`(${item})`, { refId: nextRefId, pattern });
    }
    nextRefId++;
  }
  
  // Process tokens
  const result: string[] = [];
  const definedPatterns = new Set<number>();
  
  for (const token of tokens) {
    if (token.type === 'link' && replacements.has(token.content)) {
      const { refId, pattern } = replacements.get(token.content)!;
      const inner = token.content.slice(1, -1);
      
      if (pattern.type === 'exact') {
        if (!definedPatterns.has(refId)) {
          result.push(`(${refId}: ${inner})\n`);
          definedPatterns.add(refId);
        }
        result.push(refId.toString());
      } else if (pattern.type === 'prefix') {
        const suffix = inner.substring(pattern.pattern.length).trim();
        if (!definedPatterns.has(refId)) {
          result.push(`(${refId}: ${pattern.pattern})\n`);
          definedPatterns.add(refId);
        }
        result.push(refId.toString());
        if (suffix) result.push(' ' + suffix);
      } else if (pattern.type === 'suffix') {
        const prefix = inner.substring(0, inner.length - pattern.pattern.length).trim();
        if (!definedPatterns.has(refId)) {
          result.push(`(${refId}: ${pattern.pattern})\n`);
          definedPatterns.add(refId);
        }
        if (prefix) result.push(prefix + ' ');
        result.push(refId.toString());
      }
    } else {
      result.push(token.content);
    }
  }
  
  // Clean up extra newlines
  return result.join('').replace(/\n+$/, '');
}

export function deduplicate(input: string, topPercentage: number = 0.2): string {
  if (!input.trim()) return input;
  
  const tokens = tokenize(input);
  const patterns = findPatterns(tokens);
  const selectedPatterns = selectBestPatterns(patterns, topPercentage);
  
  if (selectedPatterns.length === 0) return input;
  
  return applyPatterns(tokens, selectedPatterns);
}