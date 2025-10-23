import { create } from 'zustand'

export interface Disruption {
  id: string
  type: 'subway' | 'streetcar' | 'bus' | 'road' | 'elevator' | 'escalator'
  severity: 'severe' | 'moderate' | 'minor'
  title: string
  description: string
  affectedLines?: string[]
  timestamp: number
}

interface DisruptionStore {
  disruptions: Disruption[]
  setDisruptions: (disruptions: Disruption[]) => void
  addDisruption: (disruption: Disruption) => void
  removeDisruption: (id: string) => void
  clear: () => void
}

export const useDisruptionStore = create<DisruptionStore>((set) => ({
  disruptions: [],
  setDisruptions: (disruptions) => set({ disruptions }),
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
