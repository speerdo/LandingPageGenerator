-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  website_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  settings jsonb DEFAULT '{}'::jsonb,
  thumbnail_url text
);

-- Versions table
CREATE TABLE IF NOT EXISTS versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  version_number integer NOT NULL,
  html_content text,
  css_content text,
  marketing_content text,
  prompt_instructions text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  is_current boolean DEFAULT false
);

-- Assets table
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  version_id uuid REFERENCES versions(id) ON DELETE CASCADE,
  type text NOT NULL,
  url text NOT NULL,
  local_path text,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own projects"
  ON projects
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage versions of their projects"
  ON versions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = versions.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage assets of their projects"
  ON assets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = assets.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_versions_project_id ON versions(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_project_id ON assets(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_version_id ON assets(version_id);

-- Storage policies
DO $$
BEGIN
  -- Create project-assets bucket if it doesn't exist
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('project-assets', 'project-assets', true)
  ON CONFLICT (id) DO NOTHING;

  -- Allow authenticated users to create buckets
  CREATE POLICY "Allow authenticated users to create buckets"
  ON storage.buckets
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

  -- Allow authenticated users to read project-assets bucket
  CREATE POLICY "Allow authenticated users to read project-assets bucket"
  ON storage.buckets
  FOR SELECT
  TO authenticated
  USING (name = 'project-assets');

  -- Allow authenticated users to upload objects to project-assets bucket
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

  -- Allow authenticated users to read their project assets
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

  -- Allow authenticated users to update their project assets
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

  -- Allow authenticated users to delete their project assets
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