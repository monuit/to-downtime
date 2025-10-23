# Toronto Open Data - Available Data Analysis

## Data Sources We're Pulling

### 1. TTC GTFS-Realtime Service Alerts

**What we currently extract:**
- ✅ `header_text` → Title (e.g., "Line 1: Delays")
- ✅ `description_text` → Detailed description
- ✅ `informed_entity.route_id` → Affected lines (e.g., "1", "2", "501")
- ✅ `effect` → Impact level (NO_SERVICE, SIGNIFICANT_DELAYS, etc.)
- ✅ `cause` → Reason (ACCIDENT, MAINTENANCE, etc.)

**What we're NOT using yet (available in GTFS-RT):**

#### Temporal Information
- ⭐ **`active_period`** - Start/end time when alert is active
  ```json
  "active_period": [
    {
      "start": 1729612800,  // Unix timestamp
      "end": 1729620000
    }
  ]
  ```
  **Use case**: Show "Active until 5:30 PM" or filter expired alerts

#### Location Details
- ⭐ **`informed_entity.stop_id`** - Specific station/stop affected
  ```json
  "informed_entity": [
    {
      "route_id": "1",
      "stop_id": "BLOOR"  // Bloor-Yonge Station
    }
  ]
  ```
  **Use case**: Pin exact station on map, not just the line

- ⭐ **`informed_entity.trip`** - Specific trip affected
  **Use case**: Show "Eastbound only" or "Trip #1234 cancelled"

#### Alert Metadata
- **`url`** - Link to more information
- **`image`** - Alert image/diagram (rarely used)
- **`severity_level`** - Severity (UNKNOWN, INFO, WARNING, SEVERE)

#### Multi-language Support
- **`header_text.translation[]`** - Multiple languages
- **`description_text.translation[]`** - French, etc.

### 2. Road Restrictions

**What we currently extract:**
- ✅ `road_class` → Road type
- ✅ `restriction_type` → Type of restriction
- ✅ `location` → General location
- ✅ `description` → Details
- ✅ `start_date` → When restriction starts

**What we're NOT using yet:**

#### Temporal Information
- ⭐ **`end_date`** - When restriction ends
  **Use case**: "Gardiner closed until Nov 15"

- ⭐ **`work_schedule`** - Time windows
  ```json
  "work_schedule": "Monday-Friday 9am-4pm"
  ```
  **Use case**: "Only during rush hour" badges

#### Location Details
- ⭐ **`from_street` / `to_street`** - Exact segment
  **Use case**: "King St between Bathurst and Spadina"

- ⭐ **`direction`** - Which direction affected
  **Use case**: "Eastbound only"

- **`latitude` / `longitude`** - GPS coordinates (if available)

#### Impact Details
- **`number_of_lanes_closed`** - How many lanes
- **`work_type`** - Construction, emergency, event
- **`permit_number`** - For tracking

## 🎯 High-Value Features We Could Add

### 1. **Time-Based Filtering** (HIGHEST VALUE)
Using `active_period` from GTFS-RT:

```typescript
// Show active vs upcoming vs expired
interface DisruptionWithTime {
  status: 'active' | 'upcoming' | 'expired'
  startsAt?: Date
  endsAt?: Date
  remainingTime?: string  // "2 hours left"
}
```

**UI Impact:**
- Filter: "Show only active disruptions"
- Badge: "🔴 Active" vs "🟡 Starts in 30 min"
- Auto-refresh when status changes

### 2. **Station-Level Precision** (HIGH VALUE)
Using `informed_entity.stop_id`:

```typescript
// Instead of "Line 1 delays"
// Show "Line 1 delays between Bloor and Eglinton"
interface StationRange {
  fromStation: string
  toStation: string
  affectedStations: string[]
}
```

**UI Impact:**
- Map: Pin exact stations, not whole line
- Details: "5 stations affected: Bloor, St. George, Spadina, Dupont, St. Clair"

### 3. **Direction-Specific Alerts** (MEDIUM VALUE)
Using `informed_entity.direction_id`:

```typescript
// "Eastbound only" badge
direction: 'both' | 'eastbound' | 'westbound' | 'northbound' | 'southbound'
```

**UI Impact:**
- Badge: "→ Eastbound only"
- Filter: Only show disruptions affecting my direction

### 4. **Expiry Countdown** (MEDIUM VALUE)
Using `active_period.end`:

```typescript
// Live countdown
endsIn: "2 hours 15 minutes"
// or "Ends at 5:30 PM"
```

**UI Impact:**
- Live timer showing when disruption will be resolved
- Auto-remove expired alerts from view

### 5. **Alert Categorization** (MEDIUM VALUE)
Using GTFS-RT `cause`:

```typescript
enum DisruptionCause {
  UNKNOWN_CAUSE = 0,
  OTHER_CAUSE = 1,
  TECHNICAL_PROBLEM = 2,
  STRIKE = 3,
  DEMONSTRATION = 4,
  ACCIDENT = 5,
  HOLIDAY = 6,
  WEATHER = 7,
  MAINTENANCE = 8,
  CONSTRUCTION = 9,
  POLICE_ACTIVITY = 10,
  MEDICAL_EMERGENCY = 11
}
```

**UI Impact:**
- Icons: 🔧 Maintenance, ⛈️ Weather, 🚑 Medical
- Filter by cause type
- Stats: "Most common: Maintenance (40%)"

## 🗑️ What to Remove

### Left Sidebar Stats (Your Question)

**Current:**
```
Total: 45
Severe: 12
Moderate: 20
Minor: 13
```

**Analysis:**
- ❌ Not actionable (user can't do anything with this info)
- ❌ Takes up space
- ❌ Severity is already shown per-item with colors
- ❌ "Total" is visible from scrolling the list

**Recommendation:** **DELETE IT**

Replace with:
- Time-based filter: "Active Now" / "Upcoming" / "All"
- Type filter: Subway / Streetcar / Bus / Road
- Cause filter: Maintenance / Weather / Accident / etc.

## 📊 Enhanced Data Model

```typescript
interface EnhancedDisruption extends Disruption {
  // Temporal (from GTFS-RT active_period)
  activePeriod?: {
    start: Date
    end?: Date
    isActive: boolean
    endsIn?: string  // "2h 15m"
  }

  // Location (from informed_entity)
  affectedStops?: {
    stopIds: string[]
    stopNames: string[]
    fromStop?: string
    toStop?: string
  }

  // Direction (from informed_entity)
  direction?: 'both' | 'eastbound' | 'westbound' | 'northbound' | 'southbound'

  // Cause (from GTFS-RT)
  cause?: 'maintenance' | 'weather' | 'accident' | 'medical' | 'technical' | 'other'
  causeIcon?: string  // 🔧 ⛈️ 🚑 etc.

  // Road-specific (from road restrictions)
  roadDetails?: {
    fromStreet?: string
    toStreet?: string
    lanesAffected?: number
    workSchedule?: string
  }
}
```

## 🎨 Suggested UI Redesign

### Remove:
- ❌ Left sidebar stats (Total/Severe/Moderate/Minor)
- ❌ Generic severity badges without context

### Add:
- ✅ **Time-based chips**: "🔴 Active Now (32)" / "🟡 Upcoming (5)" / "⚪ All (45)"
- ✅ **Cause icons**: 🔧 Maintenance / ⛈️ Weather / 🚑 Medical
- ✅ **Expiry info**: "Ends at 5:30 PM" or "🕐 2h 15m left"
- ✅ **Station range**: "Between Bloor and Eglinton (5 stations)"
- ✅ **Direction badges**: "→ Eastbound only"

### Example Card:
```
🚇 Line 1 - Signal Problems          🔴 Active
🔧 Maintenance                        🕐 Ends in 2h 15m
→ Eastbound only
📍 Between Bloor and Eglinton (5 stations)

Trains moving slower than normal due to signal repairs...
```

## 💡 Recommendation

**Phase 1 (Quick Wins):**
1. Remove left sidebar stats
2. Add `active_period` parsing → show expiry time
3. Add cause icons and filtering

**Phase 2 (Map Enhancement):**
4. Parse `stop_id` → pin exact stations
5. Add direction badges

**Phase 3 (Advanced):**
6. Live countdown timers
7. Auto-remove expired alerts
8. Push notifications when new alerts for user's routes

Want me to implement any of these enhancements?
