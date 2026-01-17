-- ============================================================================
-- PHASE 1: COMPLAINTS TABLE SETUP
-- Run this in Supabase SQL Editor
--
-- Includes:
-- - Base complaints table
-- - Spam-related authenticity tagging (1.3.1.2)
-- - Authenticity tier classification (Low / Medium / High) based on tags (1.3.1.4)
--
-- Notes:
-- - Complaints are never discarded by these rules.
-- - Fabrication-related rules are deferred until inspection module exists.
-- ============================================================================

-- Create complaints table
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name VARCHAR(255) NOT NULL,
  business_address TEXT NOT NULL,
  complaint_description TEXT NOT NULL,
  reporter_email VARCHAR(255) NOT NULL,
  image_urls TEXT[] DEFAULT '{}',
  document_urls TEXT[] DEFAULT '{}',

  -- Authenticity
  -- authenticity_level: numeric score (0..100) for internal scoring.
  -- authenticity_tier: canonical 3-level classification derived from tags.
  authenticity_level integer NOT NULL DEFAULT 100,
  authenticity_tier text NOT NULL DEFAULT 'Medium',

  -- Internal flags / tags
  tags TEXT[] DEFAULT '{}',

  status VARCHAR(50) DEFAULT 'Submitted',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT email_format CHECK (
    reporter_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$'
  ),
  CONSTRAINT authenticity_level_range_chk CHECK (authenticity_level >= 0 AND authenticity_level <= 100),
  CONSTRAINT authenticity_tier_chk CHECK (authenticity_tier IN ('Low', 'Medium', 'High'))
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_complaints_email ON public.complaints(reporter_email);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON public.complaints(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);

-- Helper indexes for submission-pattern queries
CREATE INDEX IF NOT EXISTS idx_complaints_email_created_at ON public.complaints(reporter_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_establishment_created_at ON public.complaints(business_name, business_address, created_at DESC);

-- ============================================================================
-- Helpers
-- ============================================================================

CREATE OR REPLACE FUNCTION public.array_append_unique(arr text[], val text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN val IS NULL OR btrim(val) = '' THEN COALESCE(arr, '{}'::text[])
    WHEN COALESCE(arr, '{}'::text[]) @> ARRAY[val] THEN COALESCE(arr, '{}'::text[])
    ELSE COALESCE(arr, '{}'::text[]) || val
  END;
$$;

-- ============================================================================
-- Spam-Related Authenticity (1.3.1.2)
--
-- Rules implemented:
-- 1) > 5 complaints per reporter_email within 24 hours => tag High-Volume Reporter
-- 2) >= 10 distinct establishments within 7 days => tag Multi-Establishment Reporter
-- 3) >= 10 complaints for same establishment within 7 days => tag Existing Case
--    NOTE: Open mission order/inspection dependency not implemented yet.
--
-- Authenticity clamp policy (simple + explicit):
-- - If any spam rule triggers: authenticity_level = LEAST(authenticity_level, 50)
-- - If both Rule 1 and Rule 2 trigger: authenticity_level = LEAST(authenticity_level, 25)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complaints_apply_spam_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  complaints_last_24h integer := 0;
  distinct_establishments_7d integer := 0;
  complaints_for_establishment_7d integer := 0;

  hit_rule_1 boolean := false;
  hit_rule_2 boolean := false;
  hit_rule_3 boolean := false;
BEGIN
  NEW.tags := COALESCE(NEW.tags, '{}'::text[]);
  NEW.authenticity_level := COALESCE(NEW.authenticity_level, 100);

  -- Rule 1
  SELECT COUNT(*)
    INTO complaints_last_24h
  FROM public.complaints c
  WHERE c.reporter_email = NEW.reporter_email
    AND c.created_at >= (now() - interval '24 hours');

  -- Existing >=5 means NEW becomes #6
  IF complaints_last_24h >= 5 THEN
    hit_rule_1 := true;
    NEW.tags := public.array_append_unique(NEW.tags, 'High-Volume Reporter');
  END IF;

  -- Rule 2
  SELECT COUNT(*)
    INTO distinct_establishments_7d
  FROM (
    SELECT DISTINCT c.business_name, c.business_address
    FROM public.complaints c
    WHERE c.reporter_email = NEW.reporter_email
      AND c.created_at >= (now() - interval '7 days')
    UNION
    SELECT NEW.business_name, NEW.business_address
  ) d;

  IF distinct_establishments_7d >= 10 THEN
    hit_rule_2 := true;
    NEW.tags := public.array_append_unique(NEW.tags, 'Multi-Establishment Reporter');
  END IF;

  -- Rule 3
  SELECT COUNT(*)
    INTO complaints_for_establishment_7d
  FROM public.complaints c
  WHERE c.business_name = NEW.business_name
    AND c.business_address = NEW.business_address
    AND c.created_at >= (now() - interval '7 days');

  -- Existing >=9 means NEW becomes #10
  IF complaints_for_establishment_7d >= 9 THEN
    hit_rule_3 := true;
    NEW.tags := public.array_append_unique(NEW.tags, 'Existing Case');
  END IF;

  -- Clamp numeric authenticity
  IF hit_rule_1 OR hit_rule_2 OR hit_rule_3 THEN
    NEW.authenticity_level := LEAST(NEW.authenticity_level, 50);
  END IF;

  IF hit_rule_1 AND hit_rule_2 THEN
    NEW.authenticity_level := LEAST(NEW.authenticity_level, 25);
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- Level of Authenticity (1.3.1.4)
--
-- Negative tags:
-- - Failed Location Verification
-- - High-Volume Reporter
-- - Multi-Establishment Reporter
-- - Existing Case
-- - Reporter Under Review (future)
-- - Post-Clearance Complaint (future)
--
-- Positive tags:
-- - Location Verified
-- - Credible Reporter (future)
-- - Consistent With History (future)
--
-- Tier rules:
-- - Low if Failed Location Verification OR any negative tag
-- - Medium if no negative tags and <= 1 positive tag
-- - High if no negative tags and >= 2 positive tags
--
-- Numeric mapping (kept simple and consistent with tiers):
-- - Low => clamp to <= 25
-- - Medium => ensure >= 50
-- - High => ensure >= 75
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complaints_apply_authenticity_tier()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  has_negative_tag boolean := false;
  positive_tag_count integer := 0;
BEGIN
  NEW.tags := COALESCE(NEW.tags, '{}'::text[]);
  NEW.authenticity_level := COALESCE(NEW.authenticity_level, 100);
  NEW.authenticity_tier := COALESCE(NEW.authenticity_tier, 'Medium');

  has_negative_tag :=
    (NEW.tags @> ARRAY['Failed Location Verification']::text[])
    OR (NEW.tags @> ARRAY['High-Volume Reporter']::text[])
    OR (NEW.tags @> ARRAY['Multi-Establishment Reporter']::text[])
    OR (NEW.tags @> ARRAY['Existing Case']::text[])
    OR (NEW.tags @> ARRAY['Reporter Under Review']::text[])
    OR (NEW.tags @> ARRAY['Post-Clearance Complaint']::text[]);

  positive_tag_count :=
    (CASE WHEN NEW.tags @> ARRAY['Location Verified']::text[] THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.tags @> ARRAY['Credible Reporter']::text[] THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.tags @> ARRAY['Consistent With History']::text[] THEN 1 ELSE 0 END);

  IF has_negative_tag THEN
    NEW.authenticity_tier := 'Low';
    NEW.authenticity_level := LEAST(NEW.authenticity_level, 25);
  ELSIF positive_tag_count >= 2 THEN
    NEW.authenticity_tier := 'High';
    NEW.authenticity_level := GREATEST(NEW.authenticity_level, 75);
  ELSE
    NEW.authenticity_tier := 'Medium';
    NEW.authenticity_level := GREATEST(NEW.authenticity_level, 50);
  END IF;

  RETURN NEW;
END;
$$;

-- Triggers (order matters): spam tags first, tier classification second
DROP TRIGGER IF EXISTS trg_complaints_apply_spam_rules ON public.complaints;
CREATE TRIGGER trg_complaints_apply_spam_rules
BEFORE INSERT ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.complaints_apply_spam_rules();

DROP TRIGGER IF EXISTS trg_complaints_apply_authenticity_tier ON public.complaints;
CREATE TRIGGER trg_complaints_apply_authenticity_tier
BEFORE INSERT ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.complaints_apply_authenticity_tier();

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'complaints' AND policyname = 'Allow public insert'
  ) THEN
    CREATE POLICY "Allow public insert"
      ON public.complaints FOR INSERT
      WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'complaints' AND policyname = 'Allow read by email'
  ) THEN
    CREATE POLICY "Allow read by email"
      ON public.complaints FOR SELECT
      USING (TRUE);
  END IF;
END $$;

-- ============================================================================
-- STORAGE POLICIES (unchanged; require buckets created in dashboard)
-- ============================================================================

-- Policy for complaint-images bucket
CREATE POLICY "Allow public read images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'complaint-images');

CREATE POLICY "Allow authenticated upload images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'complaint-images');

-- Policy for complaint-documents bucket
CREATE POLICY "Allow public read documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'complaint-documents');

CREATE POLICY "Allow authenticated upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'complaint-documents');

-- ============================================================================
-- VERIFY SETUP
-- ============================================================================

SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'complaints';

SELECT indexname FROM pg_indexes 
WHERE schemaname = 'public' AND tablename = 'complaints';

SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'complaints';
