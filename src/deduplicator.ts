interface LinkFrequency {
  content: string;
  frequency: number;
  positions: number[];
}

export function deduplicate(input: string, topPercentage: number = 0.2): string {
  if (!input.trim()) return input;

  // Extract all links with parentheses and track their global positions
  const linkRegex = /\([^)]+\)/g;
  const allMatches = Array.from(input.matchAll(linkRegex));
  
  if (allMatches.length === 0) return input;

  // Count frequencies and track first occurrence indices
  const frequencyMap = new Map<string, { count: number; firstIndex: number }>();
  
  allMatches.forEach((match, index) => {
    const content = match[0];
    if (frequencyMap.has(content)) {
      frequencyMap.get(content)!.count++;
    } else {
      frequencyMap.set(content, { count: 1, firstIndex: index });
    }
  });

  // Filter duplicated links and sort by frequency
  const duplicatedLinks = Array.from(frequencyMap.entries())
    .filter(([content, data]) => data.count > 1)
    .sort((a, b) => b[1].count - a[1].count);

  if (duplicatedLinks.length === 0) return input;

  // Take top percentage
  const topCount = Math.max(1, Math.ceil(duplicatedLinks.length * topPercentage));
  const linksToProcess = duplicatedLinks.slice(0, topCount);

  // Create reference mapping
  const referenceMap = new Map<string, number>();
  linksToProcess.forEach(([content], index) => {
    referenceMap.set(content, index + 1);
  });

  // Process replacements from end to beginning to maintain positions
  let result = input;
  
  for (let i = allMatches.length - 1; i >= 0; i--) {
    const match = allMatches[i];
    const content = match[0];
    
    if (referenceMap.has(content)) {
      const refNumber = referenceMap.get(content)!;
      const start = match.index!;
      const end = start + content.length;
      
      // Check if this is the first occurrence
      const isFirstOccurrence = frequencyMap.get(content)!.firstIndex === i;
      
      if (isFirstOccurrence) {
        // Create reference definition
        const definition = `(${refNumber}: ${content.slice(1, -1)})`;
        result = result.substring(0, start) + definition + result.substring(end);
      } else {
        // Replace with reference number
        result = result.substring(0, start) + refNumber.toString() + result.substring(end);
      }
    }
  }

  return result;
}