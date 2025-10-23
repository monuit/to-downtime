import React from 'react'
import './Footer.css'

export const Footer: React.FC = () => {
  return (
    <footer className="app-footer">
      <div className="footer-content">
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
        <div className="footer-divider"></div>
        <div className="footer-section">
          <p className="footer-text">
            © {new Date().getFullYear()} Toronto Downtime • Real-time transit & road disruptions
          </p>
        </div>
      </div>
    </footer>
  )
}
