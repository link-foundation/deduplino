function findCommonPrefix(str1: string, str2: string): string {
  let i = 0;
  while (i < str1.length && i < str2.length && str1[i] === str2[i]) {
    i++;
  }
  return str1.substring(0, i);
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

  // Find exact pairs
  const exactPairs = Array.from(exactCounts.entries())
    .filter(([content, data]) => data.count >= 2);

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

  // Second pass: prefix detection for non-exact matches
  const contents = allMatches.map(match => match[0].slice(1, -1)); // Remove parentheses
  const prefixGroups = new Map<string, string[]>();

  // Group by common prefixes - find pairwise prefixes first
  const pairwisePrefixes = new Map<string, string[]>();
  
  for (let i = 0; i < contents.length; i++) {
    for (let j = i + 1; j < contents.length; j++) {
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

  // Find the best prefix groups (with ≥2 items)
  const validGroups = Array.from(prefixGroups.entries())
    .filter(([prefix, items]) => items.length >= 2)
    .sort((a, b) => {
      // Sort by frequency first, then by prefix length
      if (b[1].length !== a[1].length) {
        return b[1].length - a[1].length;
      }
      return b[0].length - a[0].length;
    });

  if (validGroups.length === 0) return input;

  // Take top percentage of prefix groups
  const topCount = Math.max(1, Math.ceil(validGroups.length * topPercentage));
  const groupsToProcess = validGroups.slice(0, topCount);

  // Create reference mapping and process - assign numbers based on order of appearance in input
  const referenceMap = new Map<string, { refNum: number; prefix: string }>();
  let nextRefNum = 1;
  
  // Process groups in order of appearance in the input
  for (const match of allMatches) {
    const content = match[0];
    const innerContent = content.slice(1, -1);
    
    for (const [prefix, items] of groupsToProcess) {
      if (items.includes(innerContent) && !referenceMap.has(content)) {
        // Find or assign reference number for this prefix
        let refNum = nextRefNum;
        for (const [existingContent, existingData] of referenceMap) {
          if (existingData.prefix === prefix) {
            refNum = existingData.refNum;
            break;
          }
        }
        
        if (refNum === nextRefNum) {
          nextRefNum++;
        }
        
        referenceMap.set(content, { refNum, prefix });
      }
    }
  }

  // Create a mapping to track which prefix should get which reference number
  const prefixToRefNum = new Map<string, number>();
  groupsToProcess.forEach(([prefix], index) => {
    prefixToRefNum.set(prefix, index + 1);
  });

  let result = input;
  const processedPrefixes = new Set<string>();
  
  for (let i = 0; i < allMatches.length; i++) {
    const match = allMatches[i];
    const content = match[0];
    
    if (referenceMap.has(content)) {
      const { refNum, prefix } = referenceMap.get(content)!;
      const start = match.index!;
      const end = start + content.length;
      const innerContent = content.slice(1, -1);
      const suffix = innerContent.substring(prefix.length).trim();
      
      // Check if this is the first occurrence of this prefix
      const isFirstWithPrefix = !processedPrefixes.has(prefix);
      
      if (isFirstWithPrefix) {
        processedPrefixes.add(prefix);
        const definition = `(${refNum}: ${prefix})`;
        const replacement = suffix ? `${definition}\n${refNum} ${suffix}` : definition;
        result = result.substring(0, start) + replacement + result.substring(start + content.length);
        
        // Update positions for subsequent matches
        const lengthDiff = replacement.length - content.length;
        for (let j = i + 1; j < allMatches.length; j++) {
          allMatches[j].index! += lengthDiff;
        }
      } else {
        const replacement = suffix ? `${refNum} ${suffix}` : refNum.toString();
        result = result.substring(0, start) + replacement + result.substring(start + content.length);
        
        // Update positions for subsequent matches
        const lengthDiff = replacement.length - content.length;
        for (let j = i + 1; j < allMatches.length; j++) {
          allMatches[j].index! += lengthDiff;
        }
      }
    }
  }

  return result;
}