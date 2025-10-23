/**
 * Simple logger utility with verbosity control
 */

import dotenv from 'dotenv'

// Ensure environment variables are loaded before evaluating log level
dotenv.config({ override: false })

const LOG_LEVELS = {
  QUIET: 0,    // Only critical errors and startup/shutdown
  NORMAL: 1,   // Essential info (default)
  VERBOSE: 2,  // All details (ETL progress, data counts, etc.)
}

// Read from environment, default to QUIET for local dev
const envLogLevel = process.env.LOG_LEVEL?.toLowerCase()
const logLevel = envLogLevel === 'verbose' 
  ? LOG_LEVELS.VERBOSE 
  : envLogLevel === 'normal'
  ? LOG_LEVELS.NORMAL
  : LOG_LEVELS.QUIET

export const logger = {
  // Always log errors
  error: (...args: any[]) => {
    console.error(...args)
  },

  // Essential info (startup, summary stats)
  info: (...args: any[]) => {
    if (logLevel >= LOG_LEVELS.NORMAL) {
      console.log(...args)
    }
  },

  // Detailed progress (ETL steps, individual records)
  debug: (...args: any[]) => {
    if (logLevel >= LOG_LEVELS.VERBOSE) {
      console.log(...args)
    }
  },

  // Warning messages
  warn: (...args: any[]) => {
    if (logLevel >= LOG_LEVELS.NORMAL) {
      console.warn(...args)
    }
  },
}

// Export a function to check if we should log details
export const isVerbose = () => logLevel >= LOG_LEVELS.VERBOSE
export const isQuiet = () => logLevel === LOG_LEVELS.QUIET
