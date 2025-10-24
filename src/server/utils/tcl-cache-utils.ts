/**
 * TCL Matching Cache Utilities
 * 
 * Utilities for caching expensive fuzzy matching results
 */

import crypto from 'crypto'

/**
 * Compute a hash of the disruption content to detect changes
 * Used to determine if cached match results are still valid
 * 
 * @param title - Disruption title
 * @param description - Disruption description
 * @returns SHA-256 hash of normalized content
 */
export function computeMatchHash(title: string, description?: string): string {
  // Normalize the content (lowercase, trim whitespace)
  const normalizedTitle = title.toLowerCase().trim()
  const normalizedDesc = (description || '').toLowerCase().trim()
  
  const content = `${normalizedTitle}|${normalizedDesc}`
  
  return crypto
    .createHash('sha256')
    .update(content)
    .digest('hex')
}

/**
 * Check if a cached match is still valid
 * 
 * @param cachedHash - Hash stored in database
 * @param currentTitle - Current disruption title
 * @param currentDescription - Current disruption description
 * @returns true if cache is valid, false if disruption content changed
 */
export function isCacheValid(
  cachedHash: string | null | undefined,
  currentTitle: string,
  currentDescription?: string
): boolean {
  if (!cachedHash) return false
  
  const currentHash = computeMatchHash(currentTitle, currentDescription)
  return cachedHash === currentHash
}

/**
 * Determine if a match should be re-run based on age
 * Even if content hasn't changed, periodically refresh matches
 * in case TCL segment data was updated
 * 
 * @param lastMatchedAt - Timestamp when match was last performed
 * @param maxAgeDays - Maximum age in days before re-matching (default 30)
 * @returns true if match should be refreshed
 */
export function shouldRefreshMatch(
  lastMatchedAt: Date | null | undefined,
  maxAgeDays: number = 30
): boolean {
  if (!lastMatchedAt) return true
  
  const ageMs = Date.now() - lastMatchedAt.getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  
  return ageDays > maxAgeDays
}

/**
 * Check if cached match can be used
 * 
 * @param cachedMatch - Cached match data from database
 * @param currentDisruption - Current disruption data
 * @returns true if cache can be used, false if re-matching needed
 */
export function canUseCachedMatch(
  cachedMatch: {
    tcl_match_hash?: string | null
    tcl_last_matched_at?: Date | null
    tcl_matched_street?: string | null
  },
  currentDisruption: {
    title: string
    description?: string
  }
): boolean {
  // If no cached match exists, must match
  if (!cachedMatch.tcl_matched_street && !cachedMatch.tcl_match_hash) {
    return false
  }
  
  // Check if content changed
  const hashValid = isCacheValid(
    cachedMatch.tcl_match_hash,
    currentDisruption.title,
    currentDisruption.description
  )
  
  if (!hashValid) {
    return false
  }
  
  // Check if match is too old (refresh every 30 days)
  const ageValid = !shouldRefreshMatch(cachedMatch.tcl_last_matched_at)
  
  return ageValid
}
