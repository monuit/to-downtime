import React, { useState } from 'react'
import './Legend.css'

export const Legend: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="legend-container">
      <button 
        className="legend-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label="Toggle legend"
      >
        <span className="legend-icon">ℹ️</span>
        <span className="legend-text">Legend</span>
        <span className={`legend-arrow ${isExpanded ? 'expanded' : ''}`}>▼</span>
      </button>

      {isExpanded && (
        <div className="legend-content">
          <div className="legend-section">
            <h4 className="legend-heading">Severity Levels</h4>
            <div className="legend-items">
              <div className="legend-item">
                <span className="legend-badge severe">🔴</span>
                <span className="legend-label">Severe</span>
                <span className="legend-desc">Major delays, service suspended</span>
              </div>
              <div className="legend-item">
                <span className="legend-badge moderate">🟡</span>
                <span className="legend-label">Moderate</span>
                <span className="legend-desc">Minor delays, detours active</span>
              </div>
              <div className="legend-item">
                <span className="legend-badge minor">🟢</span>
                <span className="legend-label">Minor</span>
                <span className="legend-desc">Advisory, no major impact</span>
              </div>
            </div>
          </div>

          <div className="legend-section">
            <h4 className="legend-heading">Transit Types</h4>
            <div className="legend-items">
              <div className="legend-item">
                <span className="legend-badge">🚇</span>
                <span className="legend-label">Subway</span>
              </div>
              <div className="legend-item">
                <span className="legend-badge">🚊</span>
                <span className="legend-label">Streetcar</span>
              </div>
              <div className="legend-item">
                <span className="legend-badge">🚌</span>
                <span className="legend-label">Bus</span>
              </div>
              <div className="legend-item">
                <span className="legend-badge">🛣️</span>
                <span className="legend-label">Road</span>
              </div>
              <div className="legend-item">
                <span className="legend-badge">🛗</span>
                <span className="legend-label">Elevator</span>
              </div>
              <div className="legend-item">
                <span className="legend-badge">⬆️</span>
                <span className="legend-label">Escalator</span>
              </div>
            </div>
          </div>

          <div className="legend-section">
            <h4 className="legend-heading">Time Indicators</h4>
            <div className="legend-items">
              <div className="legend-item">
                <span className="legend-badge time">NOW</span>
                <span className="legend-desc">Just reported (&lt; 1 minute)</span>
              </div>
              <div className="legend-item">
                <span className="legend-badge time">5m</span>
                <span className="legend-desc">Minutes ago</span>
              </div>
              <div className="legend-item">
                <span className="legend-badge time">2h</span>
                <span className="legend-desc">Hours ago</span>
              </div>
            </div>
          </div>

          <div className="legend-tip">
            <strong>💡 Tip:</strong> Click any disruption to see full details
          </div>
        </div>
      )}
    </div>
  )
}
