import { Disruption } from '../store/disruptions'

/**
 * Mock data for development/demo
 */
const MOCK_DISRUPTIONS: Disruption[] = [
  {
    id: 'ttc-line-1-a',
    type: 'subway',
    severity: 'severe',
    title: '🚇 Line 1 Yonge-University - Major Delays',
    description: 'Signal problems causing major delays. Expected to clear by 7:00 PM',
    affectedLines: ['1'],
    timestamp: Date.now(),
  },
  {
    id: 'ttc-line-2-b',
    type: 'subway',
    severity: 'moderate',
    title: '� Line 2 Bloor-Danforth - Single Tracking',
    description: 'Construction work requires single-track operation. Minor delays expected',
    affectedLines: ['2'],
    timestamp: Date.now(),
  },
  {
    id: 'ttc-streetcar-505',
    type: 'streetcar',
    severity: 'moderate',
    title: '🚊 Streetcar 505 Dundas - Detour',
    description: 'Temporary service detour due to road work on Dundas West',
    affectedLines: ['505'],
    timestamp: Date.now(),
  },
  {
    id: 'ttc-bus-301',
    type: 'bus',
    severity: 'minor',
    title: '� Bus 301 - Route Change',
    description: 'Temporary route change due to construction. Use 302 as alternate',
    affectedLines: ['301'],
    timestamp: Date.now(),
  },
  {
    id: 'road-1',
    type: 'road',
    severity: 'moderate',
    title: '� Gardiner Expressway - Lane Closure',
    description: 'Eastbound lanes closed between Simcoe and Bay due to emergency repairs',
    affectedLines: [],
    timestamp: Date.now(),
  },
  {
    id: 'road-2',
    type: 'road',
    severity: 'minor',
    title: '🚧 King Street - Temporary Closure',
    description: 'Westbound: Partial closure between Simcoe and Bay, 9 AM - 5 PM',
    affectedLines: [],
    timestamp: Date.now(),
  },
  {
    id: 'elevator-1',
    type: 'elevator',
    severity: 'moderate',
    title: '🛗 Bloor Station - Elevator Maintenance',
    description: 'North elevator out of service for scheduled maintenance',
    affectedLines: [],
    timestamp: Date.now(),
  },
  {
    id: 'escalator-1',
    type: 'escalator',
    severity: 'minor',
    title: '🪜 Yonge Station - Escalator Repair',
    description: 'South escalator undergoing routine maintenance, station remains accessible',
    affectedLines: [],
    timestamp: Date.now(),
  },
]

/**
 * Fetch TTC GTFS-Realtime data
 */
const fetchTTCData = async (): Promise<Disruption[]> => {
  try {
    // Try to fetch real TTC data
    const response = await fetch('https://api.ttc.ca/gtfs/alerts', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) return []

    const data = await response.json()

    // Parse TTC alerts
    return (data.alerts || []).map((alert: any, idx: number) => ({
      id: `ttc-${alert.id || idx}`,
      type: 'transit',
      severity: alert.severity || 'moderate',
      title: alert.header_text?.translation?.[0]?.text || 'TTC Alert',
      description: alert.description_text?.translation?.[0]?.text || 'Service alert',
      affectedLines: alert.informed_entity?.map((e: any) => e.route_id).filter(Boolean) || [],
      timestamp: Date.now(),
    }))
  } catch (error) {
    console.warn('Failed to fetch real TTC data, returning mock data')
    return MOCK_DISRUPTIONS.filter(d => ['subway', 'bus', 'streetcar'].includes(d.type))
  }
}

/**
 * Fetch Toronto Open Data - Road Restrictions
 */
const fetchRoadData = async (): Promise<Disruption[]> => {
  try {
    const response = await fetch(
      'https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search?resource_id=76213764-39c7-4826-9269-26bbd166f726&limit=100',
      { cache: 'no-store' }
    )

    if (!response.ok) return []

    const data = await response.json()
    const records = data.result?.records || []

    return records.map((record: any, idx: number) => ({
      id: `road-${record['_id'] || idx}`,
      type: 'road' as const,
      severity: record.severity?.toLowerCase() || 'minor',
      title: record.restriction_type || 'Road Restriction',
      description: record.details || 'Active road restriction',
      affectedLines: [],
      timestamp: new Date(record.start_date || Date.now()).getTime(),
    }))
  } catch (error) {
    console.warn('Failed to fetch real road data, returning mock data')
    return MOCK_DISRUPTIONS.filter(d => d.type === 'road')
  }
}

/**
 * Fetch Toronto Open Data - Transit Alerts
 */
const fetchTransitAlertsData = async (): Promise<Disruption[]> => {
  try {
    const response = await fetch(
      'https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search?resource_id=a5b9ac21-d8fc-4a5e-99cf-7b583d959d8e&limit=100',
      { cache: 'no-store' }
    )

    if (!response.ok) return []

    const data = await response.json()
    const records = data.result?.records || []

    return records.map((record: any, idx: number) => ({
      id: `alert-${record['_id'] || idx}`,
      type: (record.service_type?.toLowerCase() || 'elevator') as 'elevator' | 'escalator',
      severity: record.priority?.toLowerCase() || 'moderate',
      title: record.alert_type || 'Alert',
      description: record.alert_description || 'Service notification',
      affectedLines: record.route ? [record.route] : [],
      timestamp: new Date(record.alert_date || Date.now()).getTime(),
    }))
  } catch (error) {
    console.warn('Failed to fetch real transit alerts, returning mock data')
    return MOCK_DISRUPTIONS.filter(d => ['elevator', 'escalator'].includes(d.type))
  }
}

/**
 * Fetch all disruption data from multiple sources
 */
export const fetchAllDisruptionData = async (): Promise<Disruption[]> => {
  try {
    const [ttcData, roadData, alertsData] = await Promise.all([
      fetchTTCData(),
      fetchRoadData(),
      fetchTransitAlertsData(),
    ])

    const allData = [...ttcData, ...roadData, ...alertsData]

    // Deduplicate by content hash
    const seen = new Set<string>()
    const deduped = allData.filter((item) => {
      const hash = `${item.type}-${item.severity}-${item.title}`
      if (seen.has(hash)) return false
      seen.add(hash)
      return true
    })

    console.log(`✅ Fetched ${deduped.length} disruptions (${ttcData.length} TTC, ${roadData.length} Road, ${alertsData.length} Alerts)`)
    return deduped
  } catch (error) {
    console.error('Failed to fetch disruption data:', error)
    return []
  }
}
