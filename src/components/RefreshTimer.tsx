interface RefreshTimerProps {
  lastUpdated: Date | null
  loading: boolean
}

export const RefreshTimer: React.FC<RefreshTimerProps> = ({ lastUpdated, loading }) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  }

  return (
    <div className="refresh-timer">
      <div className={`status-indicator ${loading ? 'loading' : 'ready'}`}>
        {loading ? '⟳' : '✓'}
      </div>
      <div className="timer-text">
        <div className="timer-label">{loading ? 'Updating...' : 'Last updated'}</div>
        <div className="timer-value">{lastUpdated ? formatTime(lastUpdated) : 'Never'}</div>
        <div className="timer-interval">Updates every 30s</div>
      </div>
    </div>
  )
}
