# Toronto Downtime - Postgres Data Pipeline

This document explains the data storage and sync architecture using Neon Postgres.

## Architecture Overview

### Three-Layer Data System

```
┌─────────────────────────────────────────────────────────┐
│                  Neon Postgres                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ disruptions table (current)                        │
│  │  - Active disruptions                               │
│  │  - Updated in real-time                             │
│  │  - Indexed by type, severity, is_active             │
│  │                                                     │
│  ├─ disruptions_archive table (historical)             │
│  │  - Resolved disruptions                             │
│  │  - Archived with duration & timestamps              │
│  │  - 7+ days of history retained                      │
│  │                                                     │
│  └─ disruption_hashes table (deduplication)            │
│     - Content hashes (SHA256)                          │
│     - Prevents duplicate entries                       │
│     - Unique constraint on hash                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Database Schema

### `disruptions` Table (Current Active)

```sql
CREATE TABLE disruptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL,              -- 'subway', 'bus', 'streetcar', 'road', etc.
  severity VARCHAR(20) NOT NULL,          -- 'severe', 'moderate', 'minor'
  title VARCHAR(500) NOT NULL,
  description TEXT,
  affected_lines TEXT[],                  -- Array of line names
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  
  INDEX (type),
  INDEX (severity),
  INDEX (is_active),
  INDEX (created_at DESC)
);
```

### `disruptions_archive` Table (Historical)

```sql
CREATE TABLE disruptions_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  affected_lines TEXT[],
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  duration_minutes INT,                   -- How long disruption lasted
  
  INDEX (type),
  INDEX (severity),
  INDEX (archived_at DESC)
);
```

### `disruption_hashes` Table (Deduplication)

```sql
CREATE TABLE disruption_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disruption_id UUID NOT NULL REFERENCES disruptions(id) ON DELETE CASCADE,
  content_hash VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  INDEX (disruption_id),
  INDEX (content_hash)
);
```

## Data Flow

### Local One-Time Load

```
Mock Disruption Data
        ↓
[ load-data.ts ]
        ↓
Initialize Schema
        ↓
Transform Data
        ↓
Upsert Disruptions (with content hash check)
        ↓
Neon Postgres
        ↓
Ready for UI
```

**Command:**
```bash
npm run load-data
```

**What it does:**
1. Connects to Neon Postgres using `DATABASE_URL` from `.env`
2. Creates schema if tables don't exist (idempotent)
3. Transforms mock disruption data
4. Upserts each disruption
5. Records content hashes to prevent duplicates
6. Prints summary of loaded/skipped records

**Output:**
```
🔄 Starting Toronto Downtime data loader...
📋 Step 1: Initializing database schema...
✓ Database schema initialized

🔄 Step 2: Transforming disruption data...
   ✓ Transformed 8 disruptions

💾 Step 3: Loading data into Postgres...
   ✓ disruption-01: Line 1 Service Disruption...
   ✓ disruption-02: King West Streetcar...
   ...

📊 Load Summary:
   ✓ Successfully loaded: 8
   ⊘ Duplicates skipped: 0
   ✗ Errors: 0
   ℹ Total disruptions: 8

✅ Data load complete!
```

### Production Sync Cycle

```
Vercel Scheduled Function (every 30 minutes)
        ↓
[ sync.ts: syncDisruptions() ]
        ↓
Fetch Data from ETL/APIs
        ↓
Transform & Deduplicate
        ↓
├─ Upsert New/Updated
├─ Resolve Missing (→ archive)
└─ Cleanup Old Records (>30 days)
        ↓
Neon Postgres
        ↓
Update Frontend (real-time)
```

**How it works:**

1. **Fetch Fresh Data** - Calls `fetchDisruptionData()` (hooks into TTC GTFS-RT, etc.)
2. **Upsert** - For each disruption:
   - Generate content hash (SHA256 of type+severity+title+description)
   - Check if hash already exists (deduplicate)
   - If new/updated: UPSERT into disruptions table
   - Record hash in disruption_hashes table

3. **Resolve Missing** - Disruptions in DB but NOT in incoming data:
   - Move to archive (calculate duration)
   - Mark as `is_active = FALSE`
   - Record `resolved_at` timestamp

4. **Cleanup** - Delete fully resolved records older than 30 days

**Stats returned:**
```json
{
  "synced": 12,
  "updated": 3,
  "resolved": 2,
  "duplicates": 1,
  "cleaned": 0
}
```

## Implementation Guide

### Step 1: Local Load (Right Now)

```bash
# 1. Ensure .env has DATABASE_URL set
cat .env | grep DATABASE_URL

# 2. Run loader
npm run load-data

# 3. Verify data was loaded
# Log into Neon Console and query:
# SELECT COUNT(*) FROM disruptions;
# SELECT COUNT(*) FROM disruptions_archive;
```

### Step 2: Start Dev Server

```bash
npm run dev
# Opens http://localhost:5173
# Should see disruptions from DB rendered on map
```

### Step 3: Deploy to Vercel

```bash
# 1. Commit changes
git add -A
git commit -m "feat: add Postgres data pipeline with Neon integration"
git push origin main

# 2. Vercel auto-deploys
# 3. API route available at:
#    https://your-domain.vercel.app/api/sync

# 4. Configure scheduled sync:
#    - Add to vercel.json (cron configuration)
#    - Or manually trigger via POST /api/sync
```

### Step 4: Optional - Implement Real Data Fetching

Edit `src/server/etl.ts` to replace stub data with real sources:

```typescript
const fetchDisruptionData = async (): Promise<any[]> => {
  // Option 1: TTC GTFS-RT
  const gtfsRtData = await fetchGTFSRT()
  
  // Option 2: Toronto Open Data
  const openDataDisruptions = await fetchTorontoOpenData()
  
  // Option 3: City traffic incidents
  const trafficIncidents = await fetchTrafficAPI()
  
  return [...gtfsRtData, ...openDataDisruptions, ...trafficIncidents]
}
```

## Deduplication Strategy

**Content Hash Algorithm:**
```typescript
const contentHash = SHA256(`${type}|${severity}|${title}|${description}`)
```

**Why it works:**
- If same disruption fetched twice → same hash
- Hash checked before insert → skip duplicate
- Title/description minor changes = different hash = new record
- Time-based duplicates prevented by hash check

**Example:**
```
Fetch 1: "Line 1 - Signal failure - Kipling to Dundas" → hash_ABC123
Fetch 2: "Line 1 - Signal failure - Kipling to Dundas" → hash_ABC123
         → Recognized as duplicate, skipped

Fetch 3: "Line 1 - Signal failure - Kipling to Kipling" → hash_DEF456
         → New hash, different disruption, inserted
```

## Archive & Retention Policy

**Active Table (disruptions):**
- Kept while `is_active = TRUE`
- Auto-archived when no longer in sync data
- Cleanup: Delete if resolved >30 days ago

**Archive Table (disruptions_archive):**
- Permanent record of historical disruptions
- Includes duration (how long it lasted)
- Great for analytics (trend analysis, peak times, etc.)
- Automatically cleaned up after 7 days (configurable)

**Sample Query - Get Longest Disruptions (Last 7 Days):**
```sql
SELECT 
  title, 
  type, 
  severity, 
  duration_minutes,
  resolved_at
FROM disruptions_archive
WHERE archived_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY duration_minutes DESC
LIMIT 10;
```

## File Structure

```
src/
├── server/
│   ├── db.ts              ← Database utilities & schema init
│   ├── etl.ts             ← Data transformation (existing)
│   ├── load-data.ts       ← One-time local loader
│   └── sync.ts            ← Production sync service
│
api/
└── sync.ts                ← Vercel API endpoint

.env                       ← Database credentials (DATABASE_URL)
```

## Environment Variables

**Required in `.env`:**
```
DATABASE_URL=postgresql://user:password@host/db?sslmode=require
```

**Already provided by Neon:**
```
POSTGRES_URL=...
POSTGRES_USER=...
POSTGRES_PASSWORD=...
POSTGRES_DATABASE=...
POSTGRES_HOST=...
```

Use `DATABASE_URL` in code (standard Postgres connection string).

## Troubleshooting

**Error: "ECONNREFUSED" or "connect ENOTFOUND"**
- Check DATABASE_URL in .env
- Verify Neon database is running (check Neon console)
- Test connection: `psql $DATABASE_URL -c "SELECT 1"`

**Error: "duplicate key value violates unique constraint"**
- Content hash already exists
- This is expected! Deduplication working correctly.
- Check logs for "Duplicates skipped"

**Schema not initializing**
- Ensure user has CREATE TABLE permission
- Neon default user usually has sufficient privileges

**Old records not cleaning up**
- Run `cleanupOldResolved()` manually
- Or wait for scheduled sync in production

## Performance Notes

**Indexes:**
- type, severity, is_active: Quick filtering
- created_at DESC: Chronological queries
- content_hash UNIQUE: Deduplication lookup O(1)

**Limits:**
- Max 5000 pings on frontend (configurable)
- Postgres handles millions of records easily
- Archive grows indefinitely (by design - historical data)

**Query Tips:**
- Always filter by `is_active = TRUE` in active queries
- Use LIMIT when checking for old records
- Archive queries benefit from `archived_at` index

## Next Steps

1. ✅ **Now:** Run `npm run load-data` locally
2. ✅ **Then:** Run `npm run dev` and verify UI shows data
3. ✅ **Deploy:** Push to Vercel, sync runs automatically
4. 🔄 **Optional:** Implement real data sources in `fetchDisruptionData()`
5. 🔄 **Optional:** Add analytics queries to archive for dashboards

## API Examples

### Manual Sync Trigger

```bash
curl -X POST https://your-domain.vercel.app/api/sync \
  -H "Content-Type: application/json" \
  -d '{"data": []}'
```

Response:
```json
{
  "success": true,
  "message": "Disruption sync completed",
  "stats": {
    "synced": 12,
    "updated": 3,
    "resolved": 2,
    "duplicates": 1,
    "cleaned": 0
  },
  "timestamp": "2025-10-22T14:30:00Z"
}
```

### Get Active Disruptions

```bash
curl https://your-domain.vercel.app/api/sync
```

Response:
```json
{
  "success": true,
  "disruptions": [
    {
      "id": "uuid",
      "external_id": "disruption-01",
      "type": "subway",
      "severity": "severe",
      "title": "...",
      "created_at": "2025-10-22T10:00:00Z",
      ...
    }
  ]
}
```
