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
  
  // ETL metadata (optional - only populated when from real APIs)
  sourceApi?: string
  sourceUrl?: string
  rawData?: any
  lastFetchedAt?: number
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
