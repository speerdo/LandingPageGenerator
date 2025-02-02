/*
  # Add scraping logs table

  1. New Tables
    - `scraping_logs`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `url` (text)
      - `success` (boolean)
      - `assets_found` (jsonb)
      - `errors` (text[])
      - `duration_ms` (integer)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `scraping_logs` table
    - Add policy for authenticated users to read their own logs
    - Add policy for authenticated users to create logs for their projects
*/

-- Create scraping logs table
CREATE TABLE IF NOT EXISTS scraping_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  success boolean NOT NULL,
  assets_found jsonb NOT NULL,
  errors text[] DEFAULT array[]::text[],
  duration_ms integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE scraping_logs ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_scraping_logs_project_id ON scraping_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_scraping_logs_created_at ON scraping_logs(created_at);

-- RLS Policies
CREATE POLICY "Users can read scraping logs for their projects"
  ON scraping_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = scraping_logs.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create scraping logs for their projects"
  ON scraping_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = scraping_logs.project_id
      AND projects.user_id = auth.uid()
    )
  );