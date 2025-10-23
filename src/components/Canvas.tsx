import { useDisruptionStore } from '../store/disruptions'
import '../styles/Canvas.css'

export const Canvas: React.FC = () => {
  const disruptions = useDisruptionStore((state) => state.disruptions)

  const typeEmojis: Record<string, string> = {
    subway: '🚇',
    streetcar: '🚊',
    bus: '🚌',
    road: '🛣️',
    elevator: '🛗',
    escalator: '⬆️',
  }

  const severityStyles: Record<string, { bg: string; border: string; text: string }> = {
    severe: {
      bg: 'rgba(255, 68, 68, 0.1)',
      border: '2px solid #ff4444',
      text: '#ff6666',
    },
    moderate: {
      bg: 'rgba(255, 170, 0, 0.1)',
      border: '2px solid #ffaa00',
      text: '#ffb833',
    },
    minor: {
      bg: 'rgba(68, 255, 68, 0.1)',
      border: '2px solid #44ff44',
      text: '#66ff66',
    },
  }

  // Sort by severity then time
  const sorted = [...disruptions].sort((a, b) => {
    const severityOrder = { severe: 0, moderate: 1, minor: 2 }
    const aSev = severityOrder[a.severity as keyof typeof severityOrder]
    const bSev = severityOrder[b.severity as keyof typeof severityOrder]
    if (aSev !== bSev) return aSev - bSev
    return b.timestamp - a.timestamp
  })

  return (
    <div className="canvas-container">
      <div className="disruptions-grid">
        {sorted.map((disruption) => {
          const style = severityStyles[disruption.severity]
          const emoji = typeEmojis[disruption.type] || '⚠️'
          const timeAgo = Math.round((Date.now() - disruption.timestamp) / 1000)
          const timeStr = timeAgo < 60 ? `${timeAgo}s ago` : `${Math.round(timeAgo / 60)}m ago`

          return (
            <div
              key={disruption.id}
              className="disruption-card"
              style={{
                background: style.bg,
                border: style.border,
              }}
            >
              <div className="card-header">
                <span className="emoji">{emoji}</span>
                <span className="type">{disruption.type.toUpperCase()}</span>
                <span className="severity" style={{ color: style.text }}>
                  {disruption.severity.toUpperCase()}
                </span>
              </div>

              <div className="card-body">
                <div className="description">{disruption.description}</div>
                {disruption.affectedLines && disruption.affectedLines.length > 0 && (
                  <div className="affected-lines">
                    <strong>Lines:</strong> {disruption.affectedLines.join(', ')}
                  </div>
                )}
              </div>

              <div className="card-footer">
                <span className="time">{timeStr}</span>
              </div>
            </div>
          )
        })}

        {disruptions.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">✨</div>
            <div className="empty-text">No disruptions detected</div>
            <div className="empty-subtext">Toronto transit is running smoothly</div>
          </div>
        )}
      </div>
    </div>
  )
}

