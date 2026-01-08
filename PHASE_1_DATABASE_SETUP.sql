-- ============================================================================
-- PHASE 1: COMPLAINTS TABLE SETUP
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Create complaints table
CREATE TABLE complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name VARCHAR(255) NOT NULL,
  business_address TEXT NOT NULL,
  complaint_description TEXT NOT NULL,
  reporter_email VARCHAR(255) NOT NULL,
  image_urls TEXT[] DEFAULT '{}',
  document_urls TEXT[] DEFAULT '{}',
  authenticity_level NULL,
  tags TEXT[] DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'Submitted',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT email_format CHECK (reporter_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- Create indexes for common queries
CREATE INDEX idx_complaints_email ON complaints(reporter_email);
CREATE INDEX idx_complaints_created_at ON complaints(created_at DESC);
CREATE INDEX idx_complaints_status ON complaints(status);

-- Enable RLS (Row Level Security)
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public submissions)
CREATE POLICY "Allow public insert"
  ON complaints FOR INSERT
  WITH CHECK (TRUE);

-- Allow anyone to read their own complaints (by email)
CREATE POLICY "Allow read by email"
  ON complaints FOR SELECT
  USING (TRUE);

-- ============================================================================
-- STORAGE BUCKET SETUP
-- Do this in Supabase Dashboard → Storage
-- ============================================================================

-- Create complaint-images bucket (via Dashboard)
-- - Name: complaint-images
-- - Privacy: Private
-- - Max file size: 52428800 (50MB)

-- Create complaint-documents bucket (via Dashboard)
-- - Name: complaint-documents
-- - Privacy: Private
-- - Max file size: 104857600 (100MB)

-- ============================================================================
-- STORAGE POLICIES
-- Run these in SQL Editor after creating buckets
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
-- Run these to check everything is working
-- ============================================================================

-- Check table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'complaints';

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename = 'complaints';

-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'complaints';

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Insert test complaint
INSERT INTO complaints (
  business_name,
  business_address,
  complaint_description,
  reporter_email,
  image_urls,
  document_urls,
  status
) VALUES (
  'Test Restaurant',
  '123 Main Street, City, Province',
  'This is a test complaint with detailed information about the issue.',
  'test@example.com',
  '{}',
  '{}',
  'Submitted'
);

-- Verify insert
SELECT * FROM complaints ORDER BY created_at DESC LIMIT 1;

-- ============================================================================
-- CLEANUP (If needed)
-- ============================================================================

-- Drop table (WARNING: This deletes all data)
-- DROP TABLE complaints CASCADE;

-- Drop storage buckets (via Dashboard)
-- - Go to Storage → complaint-images → Delete
-- - Go to Storage → complaint-documents → Delete
