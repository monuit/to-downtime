/**
 * Test the API endpoint to see what data it returns
 * Run: node --loader ts-node/esm scripts/test-api-response.ts
 */

import dotenv from 'dotenv'
dotenv.config()

async function testAPI() {
  console.log('🌐 Testing /api/disruptions endpoint...\n')

  try {
    const response = await fetch('https://to-downtime-production.up.railway.app/api/disruptions')
    
    if (!response.ok) {
      console.error(`❌ API returned status ${response.status}`)
      return
    }

    const data = await response.json()
    
    console.log(`📊 API Response Summary:`)
    console.log(`   Success: ${data.success}`)
    console.log(`   Count: ${data.count}`)
    console.log(`   Timestamp: ${data.timestamp}\n`)

    // Check first few road disruptions
    const roadDisruptions = data.data.filter((d: any) => d.type === 'road').slice(0, 3)
    
    console.log(`🔍 Sample Road Disruptions:\n`)
    
    roadDisruptions.forEach((d: any, i: number) => {
      console.log(`Record ${i + 1}:`)
      console.log(`   external_id: ${d.external_id}`)
      console.log(`   title: ${d.title?.substring(0, 50)}...`)
      console.log(`   schedule_type: ${d.schedule_type || 'MISSING'}`)
      console.log(`   duration: ${d.duration || 'MISSING'}`)
      console.log(`   onsite_hours: ${d.onsite_hours || 'MISSING'}`)
      console.log(`   work_type: ${d.work_type || 'MISSING'}`)
      console.log('')
    })

    // Count how many have schedule data
    const total = data.data.length
    const withSchedule = data.data.filter((d: any) => d.schedule_type).length
    const withDuration = data.data.filter((d: any) => d.duration).length

    console.log(`📈 Overall API Data:`)
    console.log(`   Total disruptions: ${total}`)
    console.log(`   With schedule_type: ${withSchedule} (${Math.round(withSchedule/total*100)}%)`)
    console.log(`   With duration: ${withDuration} (${Math.round(withDuration/total*100)}%)`)

  } catch (error) {
    console.error('❌ Error testing API:', error)
  }
}

testAPI()
