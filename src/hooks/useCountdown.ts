import { useState, useEffect } from 'react'

/**
 * Hook for live countdown timers
 * Updates every minute
 */
export const useCountdown = (targetTime?: number) => {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!targetTime) return

    const interval = setInterval(() => {
      setNow(Date.now())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [targetTime])

  if (!targetTime) return null

  const diff = targetTime - now
  if (diff <= 0) return { expired: true, hours: 0, minutes: 0 }

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  return { expired: false, hours, minutes }
}
