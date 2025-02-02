/*
  # Add storage policies for project assets

  1. Changes
    - Create project-assets storage bucket
    - Add storage policies for authenticated users to:
      - Create buckets
      - Read project-assets bucket
      - Upload objects to project-assets bucket
      - Read project assets
      - Update project assets
      - Delete project assets

  2. Security
    - Enable bucket-level and object-level security
    - Restrict access to authenticated users
    - Ensure users can only access their own project assets
*/

-- Storage policies
DO $$
BEGIN
  -- Create project-assets bucket if it doesn't exist
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('project-assets', 'project-assets', true)
  ON CONFLICT (id) DO NOTHING;

  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Allow authenticated users to create buckets" ON storage.buckets;
  DROP POLICY IF EXISTS "Allow authenticated users to read project-assets bucket" ON storage.buckets;
  DROP POLICY IF EXISTS "Allow authenticated users to upload project assets" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to read project assets" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to update project assets" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to delete project assets" ON storage.objects;

  -- Create policies
  CREATE POLICY "Allow authenticated users to create buckets"
  ON storage.buckets
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

  CREATE POLICY "Allow authenticated users to read project-assets bucket"
  ON storage.buckets
  FOR SELECT
  TO authenticated
  USING (name = 'project-assets');

  CREATE POLICY "Allow authenticated users to upload project assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-assets' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text
      FROM projects
      WHERE user_id = auth.uid()
    )
  );

  CREATE POLICY "Allow authenticated users to read project assets"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'project-assets' AND
    (
      -- Allow access to assets in user's project folders
      (storage.foldername(name))[1] IN (
        SELECT id::text
        FROM projects
        WHERE user_id = auth.uid()
      )
      OR
      -- Allow access to public assets
      bucket_id = 'project-assets'
    )
  );

  CREATE POLICY "Allow authenticated users to update project assets"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'project-assets' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text
      FROM projects
      WHERE user_id = auth.uid()
    )
  );

  CREATE POLICY "Allow authenticated users to delete project assets"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-assets' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text
      FROM projects
      WHERE user_id = auth.uid()
    )
  );
END $$;