import React from 'react'
import './Footer.css'

interface FooterProps {
  lastUpdated: Date | null
  loading: boolean
}

export const Footer: React.FC<FooterProps> = ({ lastUpdated, loading }) => {
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
          <p className="footer-label">Data Sources</p>
          <div className="footer-links">
            <a href="https://opendata.toronto.ca" target="_blank" rel="noopener noreferrer">
              Open Data Toronto
            </a>
            <span className="separator">•</span>
            <a href="https://www.ttc.ca" target="_blank" rel="noopener noreferrer">
              TTC GTFS-RT
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
