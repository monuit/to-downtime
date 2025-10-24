-- Force migration 009 to re-run by deleting its record
-- Run this in Railway PostgreSQL console, then restart the app

DELETE FROM migrations WHERE id = '009';

-- Now restart your Railway app and the migration will run automatically
