import { useEffect } from 'react'
import { Canvas } from './components/Canvas'
import { Dashboard } from './components/Dashboard'
import { RefreshTimer } from './components/RefreshTimer'
import { Footer } from './components/Footer'
import { useDisruptionStore } from './store/disruptions'
import { useDataFetcher } from './hooks/useDataFetcher'
import './styles/App.css'
import './components/RefreshTimer.css'
import './components/Footer.css'

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
      <div className="header">
        <h1>🚇 Toronto Downtime</h1>
        <p>Real-time Transit & Road Disruptions</p>
        <RefreshTimer lastUpdated={lastUpdated} loading={loading} />
      </div>
      
      <div className="main-content">
        <div className="disruptions-section">
          <Canvas />
        </div>
        
        <div className="stats-section">
          <Dashboard />
        </div>
      </div>
      
      <Footer />
    </div>
  )
}

export default App
