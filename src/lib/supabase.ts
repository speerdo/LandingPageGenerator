import { createClient } from '@supabase/supabase-js';
import type { Project, Version, Asset } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<{
  public: {
    Tables: {
      projects: {
        Row: Project;
      };
      versions: {
        Row: Version;
      };
      assets: {
        Row: Asset;
      };
    };
  };
}>(supabaseUrl, supabaseAnonKey);

export async function getProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getProject(projectId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error) throw error;
  return data;
}

export async function getProjectVersions(projectId: string) {
  const { data, error } = await supabase
    .from('versions')
    .select('*')
    .eq('project_id', projectId)
    .order('version_number', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getProjectAssets(projectId: string) {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('project_id', projectId);

  if (error) throw error;
  return data;
}

export async function createProject(project: Partial<Project>) {
  const { data, error } = await supabase
    .from('projects')
    .insert(project)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProject(
  projectId: string,
  updates: Partial<Project>
) {
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProject(projectId: string) {
  // This will cascade delete all related versions and assets due to our DB constraints
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (error) throw error;
}

export async function createVersion(version: Partial<Version>) {
  // First, set all other versions' is_current to false
  if (version.is_current) {
    await supabase
      .from('versions')
      .update({ is_current: false })
      .eq('project_id', version.project_id);
  }

  const { data, error } = await supabase
    .from('versions')
    .insert(version)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateVersion(
  versionId: string,
  updates: Partial<Version>
) {
  const { data, error } = await supabase
    .from('versions')
    .update(updates)
    .eq('id', versionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function setCurrentVersion(
  projectId: string,
  versionId: string
) {
  // First, set all versions' is_current to false
  await supabase
    .from('versions')
    .update({ is_current: false })
    .eq('project_id', projectId);

  // Then set the specified version as current
  const { data, error } = await supabase
    .from('versions')
    .update({ is_current: true })
    .eq('id', versionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}