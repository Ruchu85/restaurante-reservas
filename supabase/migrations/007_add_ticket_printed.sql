-- Add ticket_printed flag to appointments (was missing from previous migrations)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS ticket_printed BOOLEAN NOT NULL DEFAULT false;

-- Ensure ticket_number is also present (from migration 005, idempotent)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS ticket_number INTEGER;
