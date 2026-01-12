-- Phase 3: Location-Based Authenticity
-- Goal: Capture geolocation and validate proximity to registered business coordinates.
--
-- What this migration adds:
-- 1) Registered coordinates for businesses (lat/lng)
-- 2) Complaint-side captured device location fields
-- 3) Optional FK link from complaints -> businesses
--
-- Notes:
-- - This file assumes you already have the Phase 1 & Phase 2 schemas applied.
-- - Uses plain numeric lat/lng for simplicity (no PostGIS dependency).

BEGIN;

-- 1) Businesses: add registered coordinates
ALTER TABLE public.businesses
  ADD COLUMN lat double precision NULL,
  ADD COLUMN lng double precision NULL;

-- Basic sanity constraints (optional but recommended)
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_lat_range_chk CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90));

ALTER TABLE public.businesses
  ADD CONSTRAINT  businesses_lng_range_chk CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180));

-- 2) Complaints: add business link + captured geolocation fields
ALTER TABLE public.complaints
  ADD COLUMN business_pk integer NULL,
  ADD COLUMN reporter_lat double precision NULL,
  ADD COLUMN reporter_lng double precision NULL,
  ADD COLUMN reporter_accuracy double precision NULL,
  ADD COLUMN reporter_location_timestamp timestamptz NULL;

-- Add FK to businesses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'complaints_business_pk_fkey'
  ) THEN
    ALTER TABLE public.complaints
      ADD CONSTRAINT complaints_business_pk_fkey
      FOREIGN KEY (business_pk)
      REFERENCES public.businesses (business_pk)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS complaints_business_pk_idx ON public.complaints (business_pk);
CREATE INDEX IF NOT EXISTS businesses_business_name_idx ON public.businesses (business_name);

COMMIT;
