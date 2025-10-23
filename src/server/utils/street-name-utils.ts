/**
 * Street Name Utilities
 * 
 * Handles street name extraction, normalization, and fuzzy matching
 * for Toronto Centreline (TCL) integration.
 */

/**
 * Extract street names from text (disruption titles/descriptions)
 * Returns array of detected street names with suffixes and directions
 */
export function extractStreetNames(text: string): string[] {
  const streets = new Set<string>()
  
  // Improved regex with negative lookahead to exclude common non-street words
  // Matches street name + suffix + optional direction
  const streetRegex = /\b(?!(?:Toronto|Hydro|Emergency|Repairs|Construction|Road|Closure|Watermain|Repair|Lane|Sidewalk|TTC|Work|Major|Project|from|between|near|and|at|on|to|affecting|closed)\b)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}?)\s+(St(?:reet)?|Ave(?:nue)?|Rd|Road|Blvd|Boulevard|Dr(?:ive)?|Cres(?:cent)?|Crt|Court|Pl(?:ace)?|Lane|Way|Line|Pkwy|Parkway)(?:\s+(W(?:est)?|E(?:ast)?|N(?:orth)?|S(?:outh)?))?\b/gi
  
  let match
  while ((match = streetRegex.exec(text)) !== null) {
    const streetName = match[1]
    const suffix = match[2]
    const direction = match[3] || ''
    streets.add(`${streetName} ${suffix}${direction ? ' ' + direction : ''}`)
  }
  
  return Array.from(streets)
}

/**
 * Normalize street name for matching
 * Converts to lowercase, expands/abbreviates forms to match TCL format
 */
export function normalizeStreetName(name: string): string {
  if (!name) return ''
  
  return name
    .toLowerCase()
    .trim()
    // Expand full forms to match TCL's abbreviated style
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\broad\b/g, 'rd')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\bboulevard\b/g, 'blvd')
    .replace(/\bparkway\b/g, 'pkwy')
    .replace(/\bcrescent\b/g, 'cres')
    .replace(/\bplace\b/g, 'pl')
    .replace(/\blane\b/g, 'lane')  // TCL uses "Lane" not "Ln"
    .replace(/\bcourt\b/g, 'crt')
    // Normalize directions
    .replace(/\bwest\b/g, 'w')
    .replace(/\beast\b/g, 'e')
    .replace(/\bnorth\b/g, 'n')
    .replace(/\bsouth\b/g, 's')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Calculate Levenshtein distance for fuzzy string matching
 * Returns the minimum number of edits to transform str1 to str2
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

/**
 * Find best matching street name from a list
 * Returns match type, score, and matched name
 */
export interface StreetMatch {
  matchType: 'exact' | 'fuzzy' | 'none'
  score: number  // Levenshtein distance (0 = exact match)
  matchedName: string | null
  confidence: number  // 0.00 to 1.00
}

export function findBestMatch(
  streetName: string,
  tclStreetNames: string[],
  maxFuzzyDistance: number = 3
): StreetMatch {
  const normalized = normalizeStreetName(streetName)
  
  // Try exact match first
  for (const tclName of tclStreetNames) {
    const tclNormalized = normalizeStreetName(tclName)
    if (normalized === tclNormalized) {
      return {
        matchType: 'exact',
        score: 0,
        matchedName: tclName,
        confidence: 1.0
      }
    }
  }
  
  // Try fuzzy match
  let bestMatch: StreetMatch = {
    matchType: 'none',
    score: Infinity,
    matchedName: null,
    confidence: 0.0
  }
  
  for (const tclName of tclStreetNames) {
    const tclNormalized = normalizeStreetName(tclName)
    const distance = levenshteinDistance(normalized, tclNormalized)
    
    if (distance < bestMatch.score) {
      bestMatch = {
        matchType: distance <= maxFuzzyDistance ? 'fuzzy' : 'none',
        score: distance,
        matchedName: distance <= maxFuzzyDistance ? tclName : null,
        confidence: distance <= maxFuzzyDistance ? (1 - (distance / 10)) : 0.0
      }
    }
  }
  
  return bestMatch
}
