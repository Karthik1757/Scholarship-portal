/*
# Fix Storage Bucket and Admin Role

1. Ensures 'documents' bucket exists and is public.
2. Adds RLS policies for document deletion (needed for withdrawal).
3. Note: To make a user an admin, you must run an INSERT statement manually.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Medium"
- Requires-Backup: false
- Reversible: true
*/

-- 1. Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Ensure RLS is enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Allow users to delete their own files (Critical for withdrawal)
-- Drop first to avoid conflict if it exists from previous attempts
DROP POLICY IF EXISTS "Allow users to delete own files" ON storage.objects;

CREATE POLICY "Allow users to delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 4. Ensure upload policy exists (idempotent check)
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 5. Ensure view policy exists
DROP POLICY IF EXISTS "Allow users to view own files" ON storage.objects;
CREATE POLICY "Allow users to view own files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
