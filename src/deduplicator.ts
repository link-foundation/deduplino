export function deduplicate(input: string, topPercentage: number = 0.2): string {
  if (!input.trim()) return input;

  // Extract all links with parentheses
  const linkRegex = /\([^)]+\)/g;
  const allMatches = Array.from(input.matchAll(linkRegex));
  
  if (allMatches.length === 0) return input;

  // Find all pairs (content appearing ≥2 times)
  const pairCounts = new Map<string, { count: number; firstIndex: number }>();
  
  allMatches.forEach((match, index) => {
    const content = match[0];
    if (pairCounts.has(content)) {
      pairCounts.get(content)!.count++;
    } else {
      pairCounts.set(content, { count: 1, firstIndex: index });
    }
  });

  // Filter to only pairs (≥2 occurrences) and sort by frequency
  const pairs = Array.from(pairCounts.entries())
    .filter(([content, data]) => data.count >= 2)
    .sort((a, b) => b[1].count - a[1].count);

  if (pairs.length === 0) return input;

  // Take top percentage of pairs
  const topCount = Math.max(1, Math.ceil(pairs.length * topPercentage));
  const pairsToProcess = pairs.slice(0, topCount);

  // Create reference mapping for selected pairs
  const referenceMap = new Map<string, number>();
  pairsToProcess.forEach(([content], index) => {
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
      
      // Check if this is the first occurrence of this pair
      const isFirstOccurrence = pairCounts.get(content)!.firstIndex === i;
      
      if (isFirstOccurrence) {
        // Create reference definition: (N: content)
        const definition = `(${refNumber}: ${content.slice(1, -1)})`;
        result = result.substring(0, start) + definition + result.substring(end);
      } else {
        // Replace with reference number: N
        result = result.substring(0, start) + refNumber.toString() + result.substring(end);
      }
    }
  }

  return result;
}