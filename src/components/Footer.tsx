import React, { useState, useEffect } from 'react'
import { Legend } from './Legend'
import './Footer.css'

interface FooterProps {
  lastUpdated: Date | null
  loading: boolean
  nextRefreshTime?: Date | null
}

type FreshnessLevel = 'fresh' | 'aging' | 'stale'

export const Footer: React.FC<FooterProps> = ({ lastUpdated, loading, nextRefreshTime }) => {
  const [countdown, setCountdown] = useState<string>('')
  const [freshness, setFreshness] = useState<FreshnessLevel>('fresh')
  const [showAbout, setShowAbout] = useState(false)

  useEffect(() => {
    if (!lastUpdated) {
      setCountdown('--')
      setFreshness('stale')
      return
    }

    const updateStatus = () => {
      const now = new Date().getTime()
      const lastUpdateTime = lastUpdated.getTime()
      const ageInSeconds = Math.floor((now - lastUpdateTime) / 1000)

      // Calculate freshness level based on age
      if (ageInSeconds < 30) {
        setFreshness('fresh')
      } else if (ageInSeconds < 60) {
        setFreshness('aging')
      } else {
        setFreshness('stale')
      }

      // Calculate countdown if we have nextRefreshTime
      if (nextRefreshTime) {
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
      } else {
        setCountdown(`${ageInSeconds}s ago`)
      }
    }

    updateStatus()
    const interval = setInterval(updateStatus, 1000)

    return () => clearInterval(interval)
  }, [nextRefreshTime, lastUpdated])

  const formatTime = (date: Date | null) => {
    if (!date) return 'Never'
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false 
    })
  }

  const getFreshnessColor = (): string => {
    switch (freshness) {
      case 'fresh':
        return '#10b981' // green
      case 'aging':
        return '#f59e0b' // yellow/orange
      case 'stale':
        return '#ef4444' // red
      default:
        return '#666'
    }
  }

  const getFreshnessLabel = (): string => {
    switch (freshness) {
      case 'fresh':
        return 'Live'
      case 'aging':
        return 'Recent'
      case 'stale':
        return 'Stale'
      default:
        return 'Unknown'
    }
  }

  return (
    <>
      <footer className="app-footer">
        <div className="footer-content">
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <button 
              className="footer-icon-button"
              onClick={() => setShowAbout(true)}
              title="About this project"
            >
              ?
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="footer-section">
            <p className="footer-label">Last Updated</p>
            <p className="footer-time">
              {loading ? 'Updating...' : formatTime(lastUpdated)}
            </p>
          </div>
          <div className="footer-divider"></div>
          <div className="footer-section">
            <p className="footer-label">Data Freshness</p>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              fontFamily: "'Geist Mono', monospace",
              fontWeight: 700,
              fontSize: '12px'
            }}>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: getFreshnessColor(),
                boxShadow: `0 0 10px ${getFreshnessColor()}`,
                transition: 'all 0.3s ease'
              }}></div>
              <span style={{ color: getFreshnessColor(), transition: 'color 0.3s ease' }}>
                {loading ? 'Updating...' : getFreshnessLabel()}
              </span>
              <span style={{ color: '#666', marginLeft: '4px' }}>
                ({countdown})
              </span>
            </div>
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
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <Legend />
        </div>
      </div>
    </footer>

    {/* About Modal */}
    {showAbout && (
      <div className="about-modal-overlay" onClick={() => setShowAbout(false)}>
        <div className="about-modal" onClick={(e) => e.stopPropagation()}>
          <button className="about-close" onClick={() => setShowAbout(false)}>✕</button>
          <h2>About This Project</h2>
          <div className="about-content">
            <p>
              You might be curious why I created this, well, same to be honest. I just like to explore and create things, 
              and I've decided this time to actually explore the city's road work because it doesn't seem like anyone can 
              actually move anywhere in the city (surprising, huh?)
            </p>
            <p>
              Anyway, if you'd like to support me and my projects, buy me a coffee:
            </p>
            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              <a href='https://ko-fi.com/Z8Z51MBSO5' target='_blank' rel="noopener noreferrer">
                <img 
                  height='36' 
                  style={{ border: 0, height: '36px' }} 
                  src='https://storage.ko-fi.com/cdn/kofi6.png?v=6' 
                  alt='Buy Me a Coffee at ko-fi.com' 
                />
              </a>
            </div>
            <p>
              Thanks! Feel free to explore all my other projects at{' '}
              <a href="https://www.monuit.dev/" target="_blank" rel="noopener noreferrer">
                monuit.dev
              </a>
            </p>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
