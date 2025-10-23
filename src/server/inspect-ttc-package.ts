/**
 * Debug Script: Inspect TTC GTFS Package Resources
 */

import https from 'https'

const BASE_URL = 'https://ckan0.cf.opendata.inter.prod-toronto.ca'
const PACKAGE_ID = '9ab4c9af-652f-4a84-abac-afcf40aae882'

const getPackageMetadata = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}/api/3/action/package_show?id=${PACKAGE_ID}`
    
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
            resolve(result.result)
          } catch (error) {
            reject(error)
          }
        })
        .on('error', reject)
    })
  })
}

const main = async () => {
  console.log('🔍 Inspecting TTC GTFS Package Resources')
  console.log('='.repeat(60))
  console.log('')

  const pkg = await getPackageMetadata()
  
  console.log(`Package: ${pkg.title}`)
  console.log(`Resources: ${pkg.resources.length}`)
  console.log('')

  pkg.resources.forEach((resource: any, idx: number) => {
    console.log(`[${idx}] ${resource.name}`)
    console.log(`    Format: ${resource.format}`)
    console.log(`    Datastore Active: ${resource.datastore_active}`)
    console.log(`    Last Modified: ${resource.last_modified}`)
    console.log(`    URL: ${resource.url}`)
    console.log('')
  })
}

main().catch(console.error)
