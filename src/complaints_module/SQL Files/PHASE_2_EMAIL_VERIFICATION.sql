-- ============================================================================
-- PHASE 2: EMAIL VERIFICATION SETUP
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1) Add email_verified flag on complaints
ALTER TABLE complaints
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Optional: Track when it was verified
ALTER TABLE complaints
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE;

-- 2) Token table (single-use, time-bound)
-- Store only a hash of the token, never the raw token.
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  complaint_id UUID NULL REFERENCES complaints(id) ON DELETE CASCADE,

  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT email_verification_tokens_email_format
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- Ensure we don't accidentally store the same hash twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_evt_token_hash ON email_verification_tokens(token_hash);

-- Helpful lookups
CREATE INDEX IF NOT EXISTS idx_evt_email ON email_verification_tokens(email);
CREATE INDEX IF NOT EXISTS idx_evt_complaint_id ON email_verification_tokens(complaint_id);
CREATE INDEX IF NOT EXISTS idx_evt_expires_at ON email_verification_tokens(expires_at);

-- 3) Enable RLS
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- 4) Policies
-- These are intentionally strict. Tokens should be created/consumed only by server-side code.
-- In practice, your Edge Function should use the Service Role key.

-- Disallow public read
DROP POLICY IF EXISTS "Deny public select" ON email_verification_tokens;
CREATE POLICY "Deny public select"
  ON email_verification_tokens FOR SELECT
  USING (FALSE);

-- Disallow public insert
DROP POLICY IF EXISTS "Deny public insert" ON email_verification_tokens;
CREATE POLICY "Deny public insert"
  ON email_verification_tokens FOR INSERT
  WITH CHECK (FALSE);

-- Disallow public update
DROP POLICY IF EXISTS "Deny public update" ON email_verification_tokens;
CREATE POLICY "Deny public update"
  ON email_verification_tokens FOR UPDATE
  USING (FALSE);

-- Disallow public delete
DROP POLICY IF EXISTS "Deny public delete" ON email_verification_tokens;
CREATE POLICY "Deny public delete"
  ON email_verification_tokens FOR DELETE
  USING (FALSE);

-- ============================================================================
-- VERIFY
-- ============================================================================

-- Confirm column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'complaints' AND column_name IN ('email_verified', 'email_verified_at');

-- Confirm token table exists
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'email_verification_tokens';
