import { useEffect, useState, useMemo } from 'react'
import { Canvas } from './components/Canvas'
import { Dashboard } from './components/Dashboard'
import { RefreshTimer } from './components/RefreshTimer'
import { Footer } from './components/Footer'
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
  const [isUserInteracting, setIsUserInteracting] = useState(false)
  const [isFiltering, setIsFiltering] = useState(false)
  const [filters, setFilters] = useState<FilterOptions>({
    workTypes: [],
    scheduleTypes: [],
    durations: [],
    impactLevels: [],
    searchText: '',
  })
  const [debouncedSearchText, setDebouncedSearchText] = useState('')

  // Debounce search text for smoother filtering
  useEffect(() => {
    setIsFiltering(true)
    const timeoutId = setTimeout(() => {
      setDebouncedSearchText(filters.searchText)
      setIsFiltering(false)
    }, 300) // 300ms delay

    return () => clearTimeout(timeoutId)
  }, [filters.searchText])

  // Detect user interaction to prevent disruptive updates
  useEffect(() => {
    let interactionTimeout: NodeJS.Timeout

    const handleInteraction = () => {
      setIsUserInteracting(true)
      clearTimeout(interactionTimeout)
      // Consider user inactive after 3 seconds of no interaction
      interactionTimeout = setTimeout(() => {
        setIsUserInteracting(false)
      }, 3000)
    }

    // Listen for various interaction events
    window.addEventListener('mousemove', handleInteraction)
    window.addEventListener('mousedown', handleInteraction)
    window.addEventListener('touchstart', handleInteraction)
    window.addEventListener('wheel', handleInteraction)
    window.addEventListener('keydown', handleInteraction)

    return () => {
      window.removeEventListener('mousemove', handleInteraction)
      window.removeEventListener('mousedown', handleInteraction)
      window.removeEventListener('touchstart', handleInteraction)
      window.removeEventListener('wheel', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
      clearTimeout(interactionTimeout)
    }
  }, [])

  // Smart data updates - only update when user is not actively interacting
  useEffect(() => {
    if (data) {
      console.log(`📊 App received ${data.length} disruptions from API`)
      const withCoords = data.filter(d => d.coordinates)
      const withoutCoords = data.length - withCoords.length
      console.log(`   - ${withCoords.length} have coordinates from DB`)
      console.log(`   - ${withoutCoords} need geocoding`)
      
      // If user is interacting, delay the update
      if (isUserInteracting) {
        console.log('⏸️ User is interacting, deferring data update...')
        const deferTimeout = setTimeout(() => {
          console.log('▶️ Applying deferred data update')
          setDisruptions(data)
        }, 3000)
        
        return () => clearTimeout(deferTimeout)
      } else {
        // User is idle, safe to update immediately
        setDisruptions(data)
      }
    }
  }, [data, setDisruptions, isUserInteracting])

  // Get available work types from disruptions
  const availableWorkTypes = useMemo(() => {
    const types = new Set(
      disruptions
        .filter(d => d.workType && d.workType !== 'false')
        .map(d => d.workType!)
    )
    return Array.from(types).sort()
  }, [disruptions])

  // Apply filters to disruptions with smooth transitions
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

    // Apply search filter with debounced text
    if (debouncedSearchText) {
      const searchLower = debouncedSearchText.toLowerCase()
      filtered = filtered.filter(d => 
        d.title.toLowerCase().includes(searchLower) ||
        d.description.toLowerCase().includes(searchLower)
      )
    }

    console.log(`🔍 Filters applied: ${disruptions.length} → ${filtered.length} disruptions`)
    return filtered
  }, [disruptions, filters.workTypes, filters.scheduleTypes, filters.durations, filters.impactLevels, debouncedSearchText])

  return (
    <div className="app-container">
      <div className="header">
        <h1>🚇 Toronto Downtime</h1>
        <p>Real-time Transit & Road Disruptions</p>
      </div>
      
      <div className="main-content">
        <div className="stats-section">
          <Dashboard disruptions={filteredDisruptions} />
        </div>

        <div className="filters-section">
          <FilterPanel 
            filters={filters}
            onFiltersChange={setFilters}
            availableWorkTypes={availableWorkTypes}
            disruptions={disruptions}
            filteredCount={filteredDisruptions.length}
            totalCount={disruptions.length}
            isFiltering={isFiltering}
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
          <Canvas 
            disruptions={filteredDisruptions}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>
      </div>
      
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
