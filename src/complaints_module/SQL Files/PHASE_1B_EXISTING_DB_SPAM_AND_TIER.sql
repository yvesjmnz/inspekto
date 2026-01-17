-- ============================================================================
-- PHASE 1B: Incremental migration for an EXISTING DB
-- Goal:
-- - Ensure complaints.authenticity_level is a usable numeric score (0..100)
-- - Add complaints.authenticity_tier (Low/Medium/High) derived from tags
-- - Implement spam-related tagging rules (1.3.1.2)
-- - Implement level-of-authenticity tiering rules (1.3.1.4)
--
-- Safe to run multiple times (uses IF NOT EXISTS / CREATE OR REPLACE / DROP TRIGGER)
-- ============================================================================

BEGIN;

-- 1) Ensure authenticity_level exists and is the right type
DO $$
BEGIN
  -- Add column if missing
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'complaints'
      AND column_name = 'authenticity_level'
  ) THEN
    ALTER TABLE public.complaints
      ADD COLUMN authenticity_level integer NOT NULL DEFAULT 100;
  ELSE
    -- If the column exists but is not integer, attempt cast
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'complaints'
        AND column_name = 'authenticity_level'
        AND data_type <> 'integer'
    ) THEN
      ALTER TABLE public.complaints
        ALTER COLUMN authenticity_level TYPE integer USING COALESCE(authenticity_level::integer, 100);
      ALTER TABLE public.complaints
        ALTER COLUMN authenticity_level SET DEFAULT 100;
      ALTER TABLE public.complaints
        ALTER COLUMN authenticity_level SET NOT NULL;
    END IF;
  END IF;
END $$;

-- Range constraint for authenticity_level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'authenticity_level_range_chk'
  ) THEN
    ALTER TABLE public.complaints
      ADD CONSTRAINT authenticity_level_range_chk CHECK (authenticity_level >= 0 AND authenticity_level <= 100);
  END IF;
END $$;

-- 2) Add authenticity_tier (Low/Medium/High)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'complaints'
      AND column_name = 'authenticity_tier'
  ) THEN
    ALTER TABLE public.complaints
      ADD COLUMN authenticity_tier text NOT NULL DEFAULT 'Medium';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'authenticity_tier_chk'
  ) THEN
    ALTER TABLE public.complaints
      ADD CONSTRAINT authenticity_tier_chk CHECK (authenticity_tier IN ('Low', 'Medium', 'High'));
  END IF;
END $$;

-- 3) Indexes needed for submission-pattern queries
CREATE INDEX IF NOT EXISTS idx_complaints_email_created_at
  ON public.complaints(reporter_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_complaints_establishment_created_at
  ON public.complaints(business_name, business_address, created_at DESC);

-- 4) Helper: append unique tag
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

-- 5) Spam-related tagging rules (1.3.1.2)
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

  -- Rule 1: >5 complaints within 24 hours from same email
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

  -- Rule 2: >=10 distinct establishments within 7 days from same email
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

  -- Rule 3: >=10 complaints for same establishment within 7 days
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

-- 6) Authenticity Tiering (1.3.1.4)
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

  -- Negative tags
  has_negative_tag :=
    (NEW.tags @> ARRAY['Failed Location Verification']::text[])
    OR (NEW.tags @> ARRAY['High-Volume Reporter']::text[])
    OR (NEW.tags @> ARRAY['Multi-Establishment Reporter']::text[])
    OR (NEW.tags @> ARRAY['Existing Case']::text[])
    OR (NEW.tags @> ARRAY['Reporter Under Review']::text[])
    OR (NEW.tags @> ARRAY['Post-Clearance Complaint']::text[]);

  -- Positive tags
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

-- 7) Triggers (order matters)
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

COMMIT;

-- ============================================================================
-- Quick verification queries (optional)
-- ============================================================================
-- \d public.complaints
-- SELECT id, reporter_email, tags, authenticity_level, authenticity_tier, created_at
-- FROM public.complaints
-- ORDER BY created_at DESC
-- LIMIT 10;
