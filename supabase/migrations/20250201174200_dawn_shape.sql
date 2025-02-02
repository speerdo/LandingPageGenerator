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
  CREATE POLICY "Allow authenticated users to read project-assets bucket"
  ON storage.buckets
  FOR SELECT
  TO authenticated
  USING (true);

  CREATE POLICY "Allow authenticated users to upload project assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'project-assets');

  CREATE POLICY "Allow authenticated users to read project assets"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'project-assets');

  CREATE POLICY "Allow authenticated users to update project assets"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'project-assets');

  CREATE POLICY "Allow authenticated users to delete project assets"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'project-assets');
END $$;