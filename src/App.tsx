import { useEffect, useState, useMemo } from 'react'
import { Canvas } from './components/Canvas'
import { Dashboard } from './components/Dashboard'
import { RefreshTimer } from './components/RefreshTimer'
import { Footer } from './components/Footer'
import { Legend } from './components/Legend'
import { MapView } from './components/MapView'
import { FilterPanel, type FilterOptions } from './components/FilterPanel'
import { DisruptionDetailsModal } from './components/DisruptionDetailsModal'
import { useDisruptionStore, type Disruption } from './store/disruptions'
import { useDataFetcher } from './hooks/useDataFetcher'
import './styles/App.css'
import './components/RefreshTimer.css'
import './components/Footer.css'

function App() {
  const { data, loading, error, lastUpdated, nextRefreshTime } = useDataFetcher()
  const setDisruptions = useDisruptionStore((state) => state.setDisruptions)
  const disruptions = useDisruptionStore((state) => state.disruptions)
  
  const [selectedDistrict, setSelectedDistrict] = useState<string | undefined>(undefined)
  const [selectedDisruption, setSelectedDisruption] = useState<Disruption | null>(null)
  const [filters, setFilters] = useState<FilterOptions>({
    workTypes: [],
    scheduleTypes: [],
    durations: [],
    impactLevels: [],
    searchText: '',
  })

  useEffect(() => {
    if (data) {
      setDisruptions(data)
    }
  }, [data, setDisruptions])

  // Get available work types from disruptions
  const availableWorkTypes = useMemo(() => {
    const types = new Set(
      disruptions
        .filter(d => d.workType && d.workType !== 'false')
        .map(d => d.workType!)
    )
    return Array.from(types).sort()
  }, [disruptions])

  // Apply filters to disruptions
  const filteredDisruptions = useMemo(() => {
    let filtered = disruptions

    // Apply work type filter
    if (filters.workTypes.length > 0) {
      filtered = filtered.filter(d => 
        d.workType && filters.workTypes.includes(d.workType)
      )
    }

    // Apply schedule type filter
    if (filters.scheduleTypes.length > 0) {
      filtered = filtered.filter(d => 
        d.scheduleType && filters.scheduleTypes.includes(d.scheduleType)
      )
    }

    // Apply duration filter
    if (filters.durations.length > 0) {
      filtered = filtered.filter(d => 
        d.duration && filters.durations.includes(d.duration)
      )
    }

    // Apply impact level filter
    if (filters.impactLevels.length > 0) {
      filtered = filtered.filter(d => 
        d.impactLevel && filters.impactLevels.includes(d.impactLevel)
      )
    }

    // Apply search filter
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase()
      filtered = filtered.filter(d => 
        d.title.toLowerCase().includes(searchLower) ||
        d.description.toLowerCase().includes(searchLower)
      )
    }

    return filtered
  }, [disruptions, filters])

  return (
    <div className="app-container">
      <div className="header">
        <h1>🚇 Toronto Downtime</h1>
        <p>Real-time Transit & Road Disruptions</p>
      </div>
      
      <div className="main-content">
        <div className="stats-section">
          <Dashboard />
        </div>

        <div className="filters-section">
          <FilterPanel 
            filters={filters}
            onFiltersChange={setFilters}
            availableWorkTypes={availableWorkTypes}
            disruptions={disruptions}
          />
        </div>
        
        <div className="map-view-section">
          <MapView 
            disruptions={filteredDisruptions}
            selectedDistrict={selectedDistrict}
            onDistrictSelect={setSelectedDistrict}
            onDisruptionSelect={setSelectedDisruption}
          />
        </div>
        
        <div className="disruptions-section">
          <Canvas />
        </div>
      </div>
      
      {/* Fixed overlay legend */}
      <Legend />
      
      {/* Disruption details modal */}
      <DisruptionDetailsModal 
        disruption={selectedDisruption}
        onClose={() => setSelectedDisruption(null)}
      />
      
      <Footer lastUpdated={lastUpdated} loading={loading} nextRefreshTime={nextRefreshTime} />
    </div>
  )
}

export default App
