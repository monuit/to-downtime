/**
 * Test API response field names vs frontend expectations
 * Run: node scripts/test-api-fields.mjs
 */

const response = await fetch('https://to-downtime-production.up.railway.app/api/disruptions')
const data = await response.json()

console.log('🔍 Checking API field names...\n')

// Get a road disruption
const roadDisruption = data.data.find(d => d.type === 'road')

console.log('📋 Sample disruption object keys:')
console.log(Object.keys(roadDisruption).sort())
console.log('\n')

console.log('🔑 Key field checks:')
console.log(`   schedule_type exists: ${roadDisruption.hasOwnProperty('schedule_type')}`)
console.log(`   scheduleType exists: ${roadDisruption.hasOwnProperty('scheduleType')}`)
console.log(`   duration exists: ${roadDisruption.hasOwnProperty('duration')}`)
console.log(`   onsite_hours exists: ${roadDisruption.hasOwnProperty('onsite_hours')}`)
console.log(`   onsiteHours exists: ${roadDisruption.hasOwnProperty('onsiteHours')}`)
console.log(`   work_type exists: ${roadDisruption.hasOwnProperty('work_type')}`)
console.log(`   workType exists: ${roadDisruption.hasOwnProperty('workType')}`)

console.log('\n📊 Actual values:')
console.log(`   schedule_type: ${roadDisruption.schedule_type}`)
console.log(`   scheduleType: ${roadDisruption.scheduleType}`)
console.log(`   duration: ${roadDisruption.duration}`)
console.log(`   onsite_hours: ${roadDisruption.onsite_hours}`)
console.log(`   onsiteHours: ${roadDisruption.onsiteHours}`)
console.log(`   work_type: ${roadDisruption.work_type}`)
console.log(`   workType: ${roadDisruption.workType}`)
