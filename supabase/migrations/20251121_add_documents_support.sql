/*
# Add Documents Support
Adds a JSONB column to scholarship_applications to store document URLs/paths.
Creates a storage bucket 'documents' for secure file uploads.

## Query Description:
1. Adds 'documents' column to 'scholarship_applications' table.
2. Inserts 'documents' bucket into storage.buckets.
3. Sets up RLS policies for the bucket to allow authenticated uploads and reads for own files.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Medium"
- Requires-Backup: false
- Reversible: true

## Structure Details:
- Table: scholarship_applications (Column added: documents)
- Storage: New bucket 'documents'

## Security Implications:
- RLS Status: Enabled on bucket
- Policy Changes: Added storage policies
*/

-- Add documents column to scholarship_applications table
ALTER TABLE public.scholarship_applications 
ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '{}'::jsonb;

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to upload files to 'documents' bucket
-- Users can only upload to their own folder (user_id/...)
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy: Allow users to view their own files
CREATE POLICY "Allow users to view own files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy: Allow users to update/delete their own files
CREATE POLICY "Allow users to update own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Allow users to delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
