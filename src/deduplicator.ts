function findCommonPrefix(str1: string, str2: string): string {
  let i = 0;
  while (i < str1.length && i < str2.length && str1[i] === str2[i]) {
    i++;
  }
  return str1.substring(0, i);
}

function findCommonSuffix(str1: string, str2: string): string {
  let i = 0;
  const len1 = str1.length;
  const len2 = str2.length;
  while (i < len1 && i < len2 && str1[len1 - 1 - i] === str2[len2 - 1 - i]) {
    i++;
  }
  return str1.substring(len1 - i);
}

function findLongestCommonPrefix(contents: string[]): string {
  if (contents.length === 0) return '';
  if (contents.length === 1) return contents[0];
  
  let prefix = contents[0];
  for (let i = 1; i < contents.length; i++) {
    prefix = findCommonPrefix(prefix, contents[i]);
    if (prefix === '') break;
  }
  
  // Ensure we break at word boundaries
  const words = prefix.split(' ');
  if (words.length > 1) {
    // Remove the last partial word to ensure clean word boundary
    return words.slice(0, -1).join(' ');
  }
  
  return prefix;
}

function findLongestCommonSuffix(contents: string[]): string {
  if (contents.length === 0) return '';
  if (contents.length === 1) return contents[0];
  
  let suffix = contents[0];
  for (let i = 1; i < contents.length; i++) {
    suffix = findCommonSuffix(suffix, contents[i]);
    if (suffix === '') break;
  }
  
  // Ensure we break at word boundaries - trim any partial word at the beginning
  if (suffix.length > 0) {
    // Check if suffix starts with a space (which means we have complete words)
    if (!suffix.startsWith(' ')) {
      // Find the first space to ensure we start at a word boundary
      const firstSpace = suffix.indexOf(' ');
      if (firstSpace > 0) {
        // Keep everything after the first space
        suffix = suffix.substring(firstSpace + 1);
      } else {
        // No space found, so this is just a partial word
        return '';
      }
    } else {
      // Remove leading space
      suffix = suffix.substring(1);
    }
  }
  
  return suffix;
}

export function deduplicate(input: string, topPercentage: number = 0.2): string {
  if (!input.trim()) return input;

  // Extract all links with parentheses
  const linkRegex = /\([^)]+\)/g;
  const allMatches = Array.from(input.matchAll(linkRegex));
  
  if (allMatches.length === 0) return input;

  // First pass: exact duplicates
  const exactCounts = new Map<string, { count: number; firstIndex: number }>();
  
  allMatches.forEach((match, index) => {
    const content = match[0];
    if (exactCounts.has(content)) {
      exactCounts.get(content)!.count++;
    } else {
      exactCounts.set(content, { count: 1, firstIndex: index });
    }
  });

  // Find exact pairs - only process content with 2+ references (words)
  const exactPairs = Array.from(exactCounts.entries())
    .filter(([content, data]) => {
      const innerContent = content.slice(1, -1); // Remove parentheses
      const referenceCount = innerContent.trim().split(/\s+/).length;
      return data.count >= 2 && referenceCount >= 2; // At least 2 occurrences AND at least 2 references
    });

  if (exactPairs.length > 0) {
    // Handle exact duplicates first
    const topCount = Math.max(1, Math.ceil(exactPairs.length * topPercentage));
    const pairsToProcess = exactPairs
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, topCount);

    const referenceMap = new Map<string, number>();
    pairsToProcess.forEach(([content], index) => {
      referenceMap.set(content, index + 1);
    });

    // First, add all definitions at the beginning
    let result = input;
    const definitions: string[] = [];
    
    pairsToProcess.forEach(([content], index) => {
      const definition = `(${index + 1}: ${content.slice(1, -1)})`;
      definitions.push(definition);
    });
    
    // Replace all occurrences with reference numbers (in reverse order)
    for (let i = allMatches.length - 1; i >= 0; i--) {
      const match = allMatches[i];
      const content = match[0];
      
      if (referenceMap.has(content)) {
        const refNumber = referenceMap.get(content)!;
        const start = match.index!;
        const end = start + content.length;
        
        result = result.substring(0, start) + refNumber.toString() + result.substring(end);
      }
    }
    
    // Prepend definitions
    if (definitions.length > 0) {
      result = definitions.join('\n') + '\n' + result;
    }
    
    return result;
  }

  // Second pass: prefix and suffix detection for non-exact matches
  // Only consider content with 2+ references
  const contents = allMatches
    .map(match => match[0].slice(1, -1)) // Remove parentheses
    .filter(content => content.trim().split(/\s+/).length >= 2); // Only 2+ references
  
  const prefixGroups = new Map<string, string[]>();
  const suffixGroups = new Map<string, string[]>();

  // Group by common prefixes - find pairwise prefixes first
  const pairwisePrefixes = new Map<string, string[]>();
  const pairwiseSuffixes = new Map<string, string[]>();
  
  for (let i = 0; i < contents.length; i++) {
    for (let j = i + 1; j < contents.length; j++) {
      // Check for prefix
      const prefix = findLongestCommonPrefix([contents[i], contents[j]]);
      if (prefix.length > 0 && prefix.includes(' ')) { // Only meaningful prefixes with spaces
        if (!pairwisePrefixes.has(prefix)) {
          pairwisePrefixes.set(prefix, []);
        }
        const group = pairwisePrefixes.get(prefix)!;
        if (!group.includes(contents[i])) {
          group.push(contents[i]);
        }
        if (!group.includes(contents[j])) {
          group.push(contents[j]);
        }
      }
      
      // Check for suffix
      const suffix = findLongestCommonSuffix([contents[i], contents[j]]);
      if (suffix.length > 0 && suffix.includes(' ')) { // Only meaningful suffixes with spaces
        if (!pairwiseSuffixes.has(suffix)) {
          pairwiseSuffixes.set(suffix, []);
        }
        const group = pairwiseSuffixes.get(suffix)!;
        if (!group.includes(contents[i])) {
          group.push(contents[i]);
        }
        if (!group.includes(contents[j])) {
          group.push(contents[j]);
        }
      }
    }
  }

  // Now consolidate - prefer longer, more specific prefixes
  const sortedPrefixes = Array.from(pairwisePrefixes.entries())
    .sort((a, b) => b[0].length - a[0].length);

  for (const [prefix, items] of sortedPrefixes) {
    if (items.length >= 2) {
      // Only add if no items are already covered by a longer prefix
      const alreadyCovered = items.some(item => {
        for (const [existingPrefix] of prefixGroups) {
          if (existingPrefix.length > prefix.length && item.startsWith(existingPrefix)) {
            return true;
          }
        }
        return false;
      });

      if (!alreadyCovered) {
        prefixGroups.set(prefix, items);
      }
    }
  }
  
  // Now consolidate suffixes - prefer longer, more specific suffixes
  const sortedSuffixes = Array.from(pairwiseSuffixes.entries())
    .sort((a, b) => b[0].length - a[0].length);

  for (const [suffix, items] of sortedSuffixes) {
    if (items.length >= 2) {
      // Only add if no items are already covered by a longer suffix
      const alreadyCovered = items.some(item => {
        for (const [existingSuffix] of suffixGroups) {
          if (existingSuffix.length > suffix.length && item.endsWith(existingSuffix)) {
            return true;
          }
        }
        return false;
      });

      if (!alreadyCovered) {
        suffixGroups.set(suffix, items);
      }
    }
  }

  // Combine prefix and suffix groups, choosing the best pattern for each set of items
  const allGroups: Array<[string, string[], 'prefix' | 'suffix']> = [];
  
  // Add prefix groups
  for (const [prefix, items] of prefixGroups) {
    if (items.length >= 2) {
      allGroups.push([prefix, items, 'prefix']);
    }
  }
  
  // Add suffix groups
  for (const [suffix, items] of suffixGroups) {
    if (items.length >= 2) {
      // Check if these items are already covered by a prefix group
      const coveredByPrefix = allGroups.some(([pattern, groupItems, type]) => 
        type === 'prefix' && 
        items.every(item => groupItems.includes(item))
      );
      
      if (!coveredByPrefix) {
        allGroups.push([suffix, items, 'suffix']);
      }
    }
  }
  
  // Sort all groups by effectiveness (frequency * pattern length)
  const validGroups = allGroups
    .sort((a, b) => {
      // Sort by frequency first, then by pattern length
      if (b[1].length !== a[1].length) {
        return b[1].length - a[1].length;
      }
      return b[0].length - a[0].length;
    });

  if (validGroups.length === 0) return input;

  // Take top percentage of groups
  const topCount = Math.max(1, Math.ceil(validGroups.length * topPercentage));
  const groupsToProcess = validGroups.slice(0, topCount);

  // Create reference mapping and process - assign numbers based on order of appearance in input
  const referenceMap = new Map<string, { refNum: number; pattern: string; type: 'prefix' | 'suffix' }>();
  let nextRefNum = 1;
  
  // Process groups in order of appearance in the input
  for (const match of allMatches) {
    const content = match[0];
    const innerContent = content.slice(1, -1);
    
    for (const [pattern, items, type] of groupsToProcess) {
      if (items.includes(innerContent) && !referenceMap.has(content)) {
        // Find or assign reference number for this pattern
        let refNum = nextRefNum;
        for (const [existingContent, existingData] of referenceMap) {
          if (existingData.pattern === pattern && existingData.type === type) {
            refNum = existingData.refNum;
            break;
          }
        }
        
        if (refNum === nextRefNum) {
          nextRefNum++;
        }
        
        referenceMap.set(content, { refNum, pattern, type });
      }
    }
  }

  // Create a mapping to track which pattern should get which reference number
  const patternToRefNum = new Map<string, number>();
  groupsToProcess.forEach(([pattern], index) => {
    patternToRefNum.set(pattern, index + 1);
  });

  let result = input;
  const processedPatterns = new Set<string>();
  
  for (let i = 0; i < allMatches.length; i++) {
    const match = allMatches[i];
    const content = match[0];
    
    if (referenceMap.has(content)) {
      const { refNum, pattern, type } = referenceMap.get(content)!;
      const start = match.index!;
      const end = start + content.length;
      const innerContent = content.slice(1, -1);
      
      let replacement: string;
      const patternKey = `${type}:${pattern}`;
      const isFirstWithPattern = !processedPatterns.has(patternKey);
      
      if (type === 'prefix') {
        const suffix = innerContent.substring(pattern.length).trim();
        
        if (isFirstWithPattern) {
          processedPatterns.add(patternKey);
          const definition = `(${refNum}: ${pattern})`;
          replacement = suffix ? `${definition}\n${refNum} ${suffix}` : definition;
        } else {
          replacement = suffix ? `${refNum} ${suffix}` : refNum.toString();
        }
      } else { // suffix
        const prefix = innerContent.substring(0, innerContent.length - pattern.length).trim();
        
        if (isFirstWithPattern) {
          processedPatterns.add(patternKey);
          const definition = `(${refNum}: ${pattern})`;
          replacement = prefix ? `(${refNum}: ${pattern})\n${prefix} ${refNum}` : definition;
        } else {
          replacement = prefix ? `${prefix} ${refNum}` : refNum.toString();
        }
      }
      
      result = result.substring(0, start) + replacement + result.substring(end);
      
      // Update positions for subsequent matches
      const lengthDiff = replacement.length - content.length;
      for (let j = i + 1; j < allMatches.length; j++) {
        allMatches[j].index! += lengthDiff;
      }
    }
  }

  return result;
}