import { create } from 'zustand'

export interface Disruption {
  id: string
  type: 'subway' | 'streetcar' | 'bus' | 'road' | 'elevator' | 'escalator'
  severity: 'severe' | 'moderate' | 'minor'
  title: string
  description: string
  affectedLines?: string[]
  timestamp: number
  
  // New UI enhancement fields
  cause?: 'maintenance' | 'weather' | 'medical' | 'mechanical' | 'investigation' | 'other'
  activePeriod?: {
    start?: number // Unix timestamp
    end?: number   // Unix timestamp
  }
  stopIds?: string[] // Affected station IDs
  direction?: 'eastbound' | 'westbound' | 'northbound' | 'southbound' | 'bidirectional'
  url?: string // Link to more info
  
  // Geographic and categorization fields
  coordinates?: {
    lat: number
    lng: number
  }
  district?: string // Toronto, North York, Scarborough, Etobicoke, etc.
  roadClass?: string // Local Road, Major Arterial, Minor Arterial, Expressway
  workType?: string // Toronto Hydro, Watermain, Construction, etc.
  contractor?: string
  scheduleType?: '24/7' | 'Weekdays Only' | 'Weekends Included'
  duration?: string // "< 1 day", "1-7 days", "1-4 weeks", "1-3 months", "3+ months"
  impactLevel?: 'Low' | 'Medium' | 'High'
  onsiteHours?: string // e.g., "Mon-Fri 7am-7pm", "24/7", etc.
  
  // ETL metadata (optional - only populated when from real APIs)
  sourceApi?: string
  sourceUrl?: string
  rawData?: any
  lastFetchedAt?: number
  
  // Toronto Centreline (TCL) address data
  addressFull?: string // e.g., "123-456 Queen St W"
  addressRange?: string // e.g., "123-456"
  hasTclMatch?: boolean
  tclMatches?: Array<{
    street_name: string
    address_range: string
    match_type: 'exact' | 'fuzzy' | 'manual'
    confidence: number
  }>
}

interface DisruptionStore {
  disruptions: Disruption[]
  selectedDisruption: Disruption | null
  setDisruptions: (disruptions: Disruption[]) => void
  setSelectedDisruption: (disruption: Disruption | null) => void
  addDisruption: (disruption: Disruption) => void
  removeDisruption: (id: string) => void
  clear: () => void
}

export const useDisruptionStore = create<DisruptionStore>((set) => ({
  disruptions: [],
  selectedDisruption: null,
  setDisruptions: (disruptions) => set({ disruptions }),
  setSelectedDisruption: (disruption) => set({ selectedDisruption: disruption }),
  addDisruption: (disruption) =>
    set((state) => ({
      disruptions: [...state.disruptions, disruption],
    })),
  removeDisruption: (id) =>
    set((state) => ({
      disruptions: state.disruptions.filter((d) => d.id !== id),
    })),
  clear: () => set({ disruptions: [] }),
}))
