import { useEffect } from 'react'
import { Canvas } from './components/Canvas'
import { Dashboard } from './components/Dashboard'
import { RefreshTimer } from './components/RefreshTimer'
import { useDisruptionStore } from './store/disruptions'
import { useDataFetcher } from './hooks/useDataFetcher'
import './styles/App.css'
import './components/RefreshTimer.css'

function App() {
  const { data, loading, error, lastUpdated } = useDataFetcher()
  const setDisruptions = useDisruptionStore((state) => state.setDisruptions)

  useEffect(() => {
    if (data) {
      setDisruptions(data)
    }
  }, [data, setDisruptions])

  return (
    <div className="app-container">
      <Canvas />
      <div className="ui-overlay">
        <div className="header">
          <h1>🚇 Toronto Downtime</h1>
          <p>Real-time Transit & Road Disruptions</p>
        </div>
        <RefreshTimer lastUpdated={lastUpdated} loading={loading} />
      </div>
      <Dashboard />
    </div>
  )
}

export default App
