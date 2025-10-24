-- Manual Backfill Script for schedule_type and duration
-- Run this directly in Railway's PostgreSQL console if migration doesn't auto-run

-- 1. Backfill schedule_type from raw_data->>'workPeriod'
UPDATE disruptions
SET schedule_type = raw_data->>'workPeriod'
WHERE schedule_type IS NULL
  AND raw_data IS NOT NULL
  AND raw_data->>'workPeriod' IS NOT NULL
  AND is_active = TRUE;

-- 2. Backfill duration by calculating from startTime and endTime
UPDATE disruptions
SET duration = CASE
  WHEN (raw_data->>'endTime')::BIGINT IS NULL THEN '< 1 day'
  WHEN ((raw_data->>'endTime')::BIGINT - (raw_data->>'startTime')::BIGINT) < 86400000 THEN '< 1 day'
  WHEN ((raw_data->>'endTime')::BIGINT - (raw_data->>'startTime')::BIGINT) < 604800000 THEN '1-7 days'
  WHEN ((raw_data->>'endTime')::BIGINT - (raw_data->>'startTime')::BIGINT) < 2419200000 THEN '1-4 weeks'
  WHEN ((raw_data->>'endTime')::BIGINT - (raw_data->>'startTime')::BIGINT) < 7776000000 THEN '1-3 months'
  ELSE '3+ months'
END
WHERE duration IS NULL
  AND raw_data IS NOT NULL
  AND raw_data->>'startTime' IS NOT NULL
  AND is_active = TRUE;

-- 3. Backfill onsite_hours from raw_data->>'scheduleEveryday'
UPDATE disruptions
SET onsite_hours = raw_data->>'scheduleEveryday'
WHERE onsite_hours IS NULL
  AND raw_data IS NOT NULL
  AND raw_data->>'scheduleEveryday' IS NOT NULL
  AND is_active = TRUE;

-- 4. Verify the results
SELECT 
  COUNT(*) FILTER (WHERE schedule_type IS NOT NULL) as with_schedule,
  COUNT(*) FILTER (WHERE duration IS NOT NULL) as with_duration,
  COUNT(*) FILTER (WHERE onsite_hours IS NOT NULL) as with_hours,
  COUNT(*) as total_active
FROM disruptions 
WHERE is_active = TRUE;
