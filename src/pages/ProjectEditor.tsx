import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Editor from '@monaco-editor/react';
import {
  Save,
  History,
  Code2,
  Eye,
  Loader2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Split,
  Wand2,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { getProjectVersions, createVersion } from '../lib/supabase';
import { generateLandingPage } from '../lib/ai';
import type { Version } from '../types/database';

function ProjectEditor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [versions, setVersions] = useState<Version[]>([]);
  const [currentVersion, setCurrentVersion] = useState<Version | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [viewMode, setViewMode] = useState<'code' | 'preview' | 'split'>('split');
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiPrompt, setShowAiPrompt] = useState(false);

  const loadVersions = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const data = await getProjectVersions(projectId);
      setVersions(data);
      const currentVer = data.find(v => v.is_current) || data[0];
      setCurrentVersion(currentVer);
      if (currentVer) {
        setEditorContent(currentVer.html_content || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project versions');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const handleSave = async () => {
    if (!projectId || !user) return;
    setIsSaving(true);
    try {
      const newVersion = await createVersion({
        project_id: projectId,
        version_number: (versions.length || 0) + 1,
        html_content: editorContent,
        created_by: user.id,
        is_current: true,
      });
      setVersions([newVersion, ...versions]);
      setCurrentVersion(newVersion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save version');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVersionSelect = (version: Version) => {
    setCurrentVersion(version);
    setEditorContent(version.html_content || '');
    setShowVersionHistory(false);
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setEditorContent(value);
    }
  };

  const handleGenerateContent = async () => {
    if (!aiPrompt.trim()) {
      setError('Please enter a prompt for the AI');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateLandingPage(
        aiPrompt, 
        currentVersion?.settings
      );
      if (result.error) {
        setError(result.error);
      } else {
        setEditorContent(result.html);
        setShowAiPrompt(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message :   'Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="mr-4 text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              {currentVersion?.project_id}
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex rounded-md shadow-sm" role="group">
              <button
                onClick={() => setViewMode('code')}
                className={`px-4 py-2 text-sm font-medium rounded-l-lg border ${
                  viewMode === 'code'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                title="Code View"
              >
                <Code2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`px-4 py-2 text-sm font-medium border-t border-b ${
                  viewMode === 'split'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                title="Split View"
              >
                <Split className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`px-4 py-2 text-sm font-medium rounded-r-lg border ${
                  viewMode === 'preview'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                title="Preview"
              >
                <Eye className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => setShowVersionHistory(!showVersionHistory)}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                showVersionHistory
                  ? 'bg-gray-200 text-gray-700'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              <History className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowAiPrompt(!showAiPrompt)}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                showAiPrompt
                  ? 'bg-gray-200 text-gray-700'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              <Wand2 className="h-4 w-4" />
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Version
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 rounded-md">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        )}

        {/* AI Prompt */}
        {showAiPrompt && (
          <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-start space-x-4">
              <div className="flex-1">
                <label
                  htmlFor="ai-prompt"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Describe your landing page
                </label>
                <textarea
                  id="ai-prompt"
                  rows={3}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="E.g., Create a modern landing page for a SaaS product with a hero section, features, and pricing"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={handleGenerateContent}
                disabled={isGenerating}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 mt-6"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                Generate
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex gap-6">
          {/* Editor/Preview */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className={`h-[calc(100vh-16rem)] ${viewMode === 'split' ? 'grid grid-cols-2 gap-2' : ''}`}>
                {(viewMode === 'code' || viewMode === 'split') && (
                  <div className={viewMode === 'split' ? 'border-r' : ''}>
                    <Editor
                      height="100%"
                      defaultLanguage="html"
                      value={editorContent}
                      onChange={handleEditorChange}
                      theme="vs-light"
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        wordWrap: 'on',
                        formatOnPaste: true,
                        formatOnType: true,
                      }}
                    />
                  </div>
                )}
                {(viewMode === 'preview' || viewMode === 'split') && (
                  <div className="h-full overflow-auto bg-white">
                    <iframe
                      srcDoc={editorContent}
                      title="Preview"
                      className="w-full h-full border-0"
                      sandbox="allow-scripts"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Version History Sidebar */}
          {showVersionHistory && (
            <div className="w-80">
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Version History
                </h3>
                <div className="space-y-4">
                  {versions.map((version) => (
                    <button
                      key={version.id}
                      onClick={() => handleVersionSelect(version)}
                      className={`w-full text-left p-3 rounded-md ${
                        currentVersion?.id === version.id
                          ? 'bg-indigo-50 border-indigo-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-900">
                          Version {version.version_number}
                        </span>
                        {version.is_current && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            Current
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(version.created_at).toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectEditor;