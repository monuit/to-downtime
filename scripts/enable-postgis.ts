/**
 * Enable PostGIS Extension in Railway PostgreSQL Database
 */

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

async function enablePostGIS() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  })

  try {
    console.log('🔌 Connecting to Railway PostgreSQL...')
    console.log('   Database:', process.env.DATABASE_URL?.split('@')[1]?.split('/')[1] || 'railway')
    
    const client = await pool.connect()
    
    console.log('✅ Connected successfully')
    console.log('')
    console.log('📍 Enabling PostGIS extension...')
    
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS postgis;')
      console.log('✅ PostGIS extension enabled successfully!')
      console.log('')
      
      // Verify PostGIS is working
      console.log('🔍 Verifying PostGIS installation...')
      const result = await client.query('SELECT PostGIS_Version();')
      console.log('✅ PostGIS Version:', result.rows[0].postgis_version)
      console.log('')
      console.log('🎉 PostGIS is now ready to use!')
      console.log('')
      console.log('Next steps:')
      console.log('1. Restart your application: npm run dev')
      console.log('2. The migration will now use PostGIS GEOMETRY type')
      console.log('3. Check logs for "✅ PostGIS extension enabled"')
      
    } catch (error: any) {
      console.error('❌ Failed to enable PostGIS:', error.message)
      console.error('')
      console.error('This might be because:')
      console.error('1. PostGIS is not installed on the Railway database server')
      console.error('2. You need to contact Railway support to install PostGIS')
      console.error('3. Or use Railway\'s PostGIS template instead')
      console.error('')
      console.error('Alternative: The app will work fine with TEXT fallback for development')
      process.exit(1)
    }
    
    client.release()
    await pool.end()
    
  } catch (error: any) {
    console.error('❌ Connection failed:', error.message)
    console.error('')
    console.error('Please check your DATABASE_URL in .env file')
    process.exit(1)
  }
}

enablePostGIS()
