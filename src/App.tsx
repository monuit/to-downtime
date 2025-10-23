import { useEffect, useState } from 'react'
import { Canvas } from './components/Canvas'
import { Analytics } from './components/Analytics'
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
  const [view, setView] = useState<'disruptions' | 'analytics'>('disruptions')

  useEffect(() => {
    if (data) {
      setDisruptions(data)
    }
  }, [data, setDisruptions])

  return (
    <div className="app-container">
      {view === 'disruptions' ? (
        <Canvas />
      ) : (
        <Analytics />
      )}
      <div className="ui-overlay">
        <div className="header">
          <h1>🚇 Toronto Downtime</h1>
          <p>Real-time Transit & Road Disruptions</p>
          <div className="view-toggle">
            <button
              className={`toggle-btn ${view === 'disruptions' ? 'active' : ''}`}
              onClick={() => setView('disruptions')}
            >
              📋 Disruptions
            </button>
            <button
              className={`toggle-btn ${view === 'analytics' ? 'active' : ''}`}
              onClick={() => setView('analytics')}
            >
              📊 Analytics
            </button>
          </div>
        </div>
        <RefreshTimer lastUpdated={lastUpdated} loading={loading} />
      </div>
      <Dashboard />
      <Footer />
    </div>
  )
}

export default App
