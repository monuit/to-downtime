import https from 'https'
import { Disruption } from '../../store/disruptions'
import { ckanRateLimiter } from '../utils/rate-limiter.js'

/**
 * Road Restrictions ETL Service
 * Fetches active road restrictions from Toronto Open Data CKAN API
 * 
 * Data Source: Toronto Open Data - Road Restrictions
 * Package Name: road-restrictions
 * API: CKAN package_show + resource downloads
 * 
 * Documentation:
 * - CKAN API: https://docs.ckan.org/en/latest/api/
 * - Toronto Open Data: https://open.toronto.ca/
 */

const PACKAGE_NAME = 'road-restrictions'
const BASE_URL = 'https://ckan0.cf.opendata.inter.prod-toronto.ca'

interface CKANResource {
  id: string
  name: string
  format: string
  url: string
  datastore_active: boolean
  last_modified: string
  description?: string
}

interface CKANPackage {
  id: string
  name: string
  title: string
  metadata_modified: string
  resources: CKANResource[]
}

/**
 * Fetch package metadata from CKAN API (with rate limiting)
 */
const getPackageMetadata = (): Promise<CKANPackage> => {
  return ckanRateLimiter.executeQueued(() => {
    return new Promise((resolve, reject) => {
      const url = `${BASE_URL}/api/3/action/package_show?id=${PACKAGE_NAME}`
      
      https.get(url, (response) => {
      const dataChunks: Buffer[] = []
      
      response
        .on('data', (chunk: Buffer) => {
          dataChunks.push(chunk)
        })
        .on('end', () => {
          try {
            const data = Buffer.concat(dataChunks)
            const result = JSON.parse(data.toString())
            
            if (!result.success) {
              reject(new Error('CKAN API returned success=false'))
              return
            }
            
            resolve(result.result as CKANPackage)
          } catch (error) {
            reject(error)
          }
        })
        .on('error', (error) => {
          reject(error)
        })
    })
  })
  })
}

/**
 * Fetch resource data from URL (with rate limiting)
 */
const fetchResourceData = (url: string): Promise<any> => {
  return ckanRateLimiter.executeQueued(() => {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : require('http')
      
      protocol.get(url, (response: any) => {
        const dataChunks: Buffer[] = []
        
        response
          .on('data', (chunk: Buffer) => {
            dataChunks.push(chunk)
          })
          .on('end', () => {
            try {
              const buffer = Buffer.concat(dataChunks)
              const jsonData = JSON.parse(buffer.toString())
              resolve(jsonData)
            } catch (error) {
              // If not JSON, might be CSV or other format
              const buffer = Buffer.concat(dataChunks)
              resolve({ raw: buffer.toString() })
            }
          })
          .on('error', (error: Error) => {
            reject(error)
          })
      })
    })
  })
}

/**
 * Parse road restriction record to Disruption format
 */
const parseRoadRestriction = (record: any, sourceUrl: string): Disruption | null => {
  try {
    // Extract relevant fields from the Toronto Open Data format
    const roadName = record.road || record.street_name || record.location || 'Unknown Road'
    const restrictionName = record.name || ''
    const workType = record.workEventType || record.work_type || 'Road Work'
    
    const title = restrictionName || `${workType} on ${roadName}`
    
    const description = record.description || 
                       `${workType} - ${restrictionName}`.trim()
    
    const location = record.name || roadName

    // Determine severity based on maxImpact or currImpact
    let severity: Disruption['severity'] = 'minor'
    const maxImpact = (record.maxImpact || '').toLowerCase()
    const currImpact = (record.currImpact || '').toLowerCase()
    const type = (record.type || '').toLowerCase()
    
    if (maxImpact === 'high' || currImpact === 'high' || type === 'road_closed') {
      severity = 'severe'
    } else if (maxImpact === 'medium' || currImpact === 'medium') {
      severity = 'moderate'
    }

    // Generate external ID - use record.id directly if available
    // Record IDs from API look like: "Tor-RD012025-279", "Tor-RD1S2025-221-1"
    const externalId = record.id 
      ? `road-${record.id}` 
      : `road-generated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Parse dates (timestamps in milliseconds)
    const startDate = record.startTime ? parseInt(record.startTime) : Date.now()

    return {
      id: externalId,
      type: 'road',
      severity,
      title: `🚧 ${title}`,
      description: description.trim(),
      affectedLines: [],
      timestamp: startDate,
      sourceApi: 'Toronto Open Data - Road Restrictions',
      sourceUrl,
      rawData: record,
      lastFetchedAt: Date.now(),
    }
  } catch (error) {
    console.error('Error parsing road restriction:', error, record)
    return null
  }
}

/**
 * Fetch and parse all road restrictions
 */
export const fetchRoadRestrictions = async (): Promise<{
  disruptions: Disruption[]
  metadata: {
    source: string
    packageName: string
    fetchedAt: string
    resourceCount: number
  }
}> => {
  try {
    console.log('🚧 Fetching Road Restrictions from Toronto Open Data...')
    
    // Get package metadata
    const pkg = await getPackageMetadata()
    console.log(`📦 Package: ${pkg.title}`)
    console.log(`📁 Resources: ${pkg.resources.length}`)

    const disruptions: Disruption[] = []
    let processedResources = 0

    // Process each resource
    for (const resource of pkg.resources) {
      console.log(`📥 Resource: ${resource.name} (${resource.format})`)
      
      // Skip non-data resources (like documentation PDFs)
      if (resource.format !== 'JSON' && 
          resource.format !== 'CSV' && 
          !resource.datastore_active) {
        console.log(`⏭️  Skipping ${resource.format} resource`)
        continue
      }

      try {
        let records: any[] = []

        if (resource.datastore_active) {
          // Use datastore API for active datastores
          const datastoreUrl = `${BASE_URL}/api/3/action/datastore_search?resource_id=${resource.id}&limit=1000`
          console.log(`🔗 Fetching from datastore: ${datastoreUrl}`)
          
          const datastoreData = await fetchResourceData(datastoreUrl)
          records = datastoreData.result?.records || []
        } else if (resource.url) {
          // Direct download for non-datastore resources
          console.log(`🔗 Downloading from: ${resource.url}`)
          const resourceData = await fetchResourceData(resource.url)
          
          // Handle different formats
          if (Array.isArray(resourceData)) {
            records = resourceData
          } else if (resourceData.Closure) {
            // Toronto Open Data road restrictions format
            records = resourceData.Closure
          } else if (resourceData.records) {
            records = resourceData.records
          } else if (resourceData.result?.records) {
            records = resourceData.result.records
          }
        }

        console.log(`📊 Found ${records.length} records in resource`)

        // Parse records
        const resourceUrl = resource.url || `datastore:${resource.id}`
        const parsed = records
          .map((record: any) => parseRoadRestriction(record, resourceUrl))
          .filter((d): d is Disruption => d !== null)

        disruptions.push(...parsed)
        processedResources++
        
        console.log(`✅ Parsed ${parsed.length} road restrictions from ${resource.name}`)
      } catch (error) {
        console.error(`❌ Error processing resource ${resource.name}:`, error)
        // Continue with other resources
      }
    }

    console.log(`✅ Total parsed: ${disruptions.length} road restrictions from ${processedResources} resources`)

    return {
      disruptions,
      metadata: {
        source: 'Toronto Open Data - Road Restrictions',
        packageName: PACKAGE_NAME,
        fetchedAt: new Date().toISOString(),
        resourceCount: processedResources,
      },
    }
  } catch (error) {
    console.error('❌ Error fetching road restrictions:', error)
    throw error
  }
}
