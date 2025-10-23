import React, { useState, useEffect } from 'react'
import './Footer.css'

interface FooterProps {
  lastUpdated: Date | null
  loading: boolean
  nextRefreshTime?: Date | null
}

export const Footer: React.FC<FooterProps> = ({ lastUpdated, loading, nextRefreshTime }) => {
  const [countdown, setCountdown] = useState<string>('')

  useEffect(() => {
    if (!nextRefreshTime) {
      setCountdown('--')
      return
    }

    const updateCountdown = () => {
      const now = new Date().getTime()
      const target = nextRefreshTime.getTime()
      const diff = target - now

      if (diff <= 0) {
        setCountdown('Refreshing...')
        return
      }

      const seconds = Math.floor(diff / 1000)
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60

      if (minutes > 0) {
        setCountdown(`${minutes}m ${remainingSeconds}s`)
      } else {
        setCountdown(`${remainingSeconds}s`)
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [nextRefreshTime])

  const formatTime = (date: Date | null) => {
    if (!date) return 'Never'
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false 
    })
  }

  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-section">
          <p className="footer-label">Last Updated</p>
          <p className="footer-time">
            {loading ? 'Updating...' : formatTime(lastUpdated)}
          </p>
        </div>
        <div className="footer-divider"></div>
        <div className="footer-section">
          <p className="footer-label">Next Refresh</p>
          <p className="footer-time">
            {loading ? 'Updating...' : countdown}
          </p>
        </div>
        <div className="footer-divider"></div>
        <div className="footer-section">
          <p className="footer-label">Data Sources</p>
          <div className="footer-links">
            <a href="https://open.toronto.ca/" target="_blank" rel="noopener noreferrer">
              Open Data Toronto
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
