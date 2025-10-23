import React from 'react'
import { Disruption } from '../store/disruptions'
import './StatusBar.css'

interface StatusBarProps {
  disruptions: Disruption[]
}

export const StatusBar: React.FC<StatusBarProps> = ({ disruptions }) => {
  // Count by severity
  const severeCount = disruptions.filter(d => d.severity === 'severe').length
  const moderateCount = disruptions.filter(d => d.severity === 'moderate').length
  const minorCount = disruptions.filter(d => d.severity === 'minor').length

  // Get unique affected lines
  const affectedLines = Array.from(
    new Set(
      disruptions
        .flatMap(d => d.affectedLines || [])
        .filter(Boolean)
    )
  ).sort((a, b) => {
    // Sort numerically if possible
    const aNum = parseInt(a)
    const bNum = parseInt(b)
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum
    return a.localeCompare(b)
  })

  return (
    <div className="status-bar">
      <div className="status-counts">
        <div className="status-count severe">
          <span className="status-dot">🔴</span>
          <span className="status-number">{severeCount}</span>
        </div>
        <div className="status-count moderate">
          <span className="status-dot">🟡</span>
          <span className="status-number">{moderateCount}</span>
        </div>
        <div className="status-count minor">
          <span className="status-dot">🟢</span>
          <span className="status-number">{minorCount}</span>
        </div>
      </div>
      {affectedLines.length > 0 && (
        <>
          <div className="status-divider"></div>
          <div className="status-lines">
            <span className="status-label">Lines:</span>
            <span className="status-value">{affectedLines.join(', ')}</span>
          </div>
        </>
      )}
    </div>
  )
}
