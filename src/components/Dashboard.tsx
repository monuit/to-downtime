import { useDisruptionStore } from '../store/disruptions'
import '../styles/Dashboard.css'

export const Dashboard: React.FC = () => {
  const disruptions = useDisruptionStore((state) => state.disruptions)

  const stats = {
    total: disruptions.length,
    severe: disruptions.filter((d) => d.severity === 'severe').length,
    moderate: disruptions.filter((d) => d.severity === 'moderate').length,
    minor: disruptions.filter((d) => d.severity === 'minor').length,
  }

  return (
    <div className="dashboard">
      <div className="stats-container">
        <div className="stat-item">
          <div className="stat-label">Total</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-item severe">
          <div className="stat-label">Severe</div>
          <div className="stat-value">{stats.severe}</div>
        </div>
        <div className="stat-item moderate">
          <div className="stat-label">Moderate</div>
          <div className="stat-value">{stats.moderate}</div>
        </div>
        <div className="stat-item minor">
          <div className="stat-label">Minor</div>
          <div className="stat-value">{stats.minor}</div>
        </div>
      </div>
    </div>
  )
}
