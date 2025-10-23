import { fetchAllDisruptionData } from './api-client'

// Test the API client
const test = async () => {
  console.log('Testing API client...')
  try {
    const data = await fetchAllDisruptionData()
    console.log('✅ Success! Got data:', data.length, 'items')
    console.log(data)
  } catch (error) {
    console.error('❌ Failed:', error)
  }
}

test()
