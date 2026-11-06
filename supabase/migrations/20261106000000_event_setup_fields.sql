-- Event setup fields for the guided organiser wizard.
-- Additive migration: existing events and ticket records remain valid.
-- Quick Create still inserts an event name only; setup metadata can be completed later.

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS "timezone" text NOT NULL DEFAULT 'Africa/Johannesburg',
  ADD COLUMN IF NOT EXISTS venue_name text,
  ADD COLUMN IF NOT EXISTS venue_address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS setup_completed_at timestamptz;

-- Both dates are optional while setup is in progress.
-- When both dates exist, the event must end after it starts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.events'::regclass
      AND conname = 'events_end_after_start_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_end_after_start_check
      CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at);
  END IF;

  -- Finishing setup requires both dates; other fields remain optional.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.events'::regclass
      AND conname = 'events_setup_dates_required_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_setup_dates_required_check
      CHECK (
        setup_completed_at IS NULL
        OR (starts_at IS NOT NULL AND ends_at IS NOT NULL)
      );
  END IF;
END
$$;

COMMIT;
