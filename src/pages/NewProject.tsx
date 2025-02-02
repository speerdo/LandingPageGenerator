import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Globe,
  Type,
  Settings,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Wand2,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { createProject, createVersion } from '../lib/supabase';
import { generateLandingPage, getFallbackTemplate } from '../lib/ai';
import { scrapeWebsite } from '../lib/scraper';
import type { Project, ProjectSettings, WebsiteStyle } from '../types/database';

type Step = 'url' | 'content' | 'settings';

function NewProject() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>('url');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  // Form state
  const [projectName, setProjectName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [brand, setBrand] = useState('');
  const [marketingContent, setMarketingContent] = useState('');
  const [useLorem, setUseLorem] = useState(false);
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [extractedAssets, setExtractedAssets] = useState<WebsiteStyle | null>(null);

  const steps = [
    { id: 'url' as const, title: 'Website URL', icon: <Globe className="h-6 w-6" /> },
    { id: 'content' as const, title: 'Content', icon: <Type className="h-6 w-6" /> },
    { id: 'settings' as const, title: 'Settings', icon: <Settings className="h-6 w-6" /> },
  ];

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!websiteUrl) {
        throw new Error('Please enter a valid website URL');
      }

      if (!user) {
        throw new Error('Please log in to continue');
      }

      // Create the project first
      const project = await createProject({
        user_id: user.id,
        name: projectName || 'Untitled Project',
        website_url: websiteUrl,
        settings: {},
        status: 'draft'
      });

      setCurrentProject(project);

      // Scrape website with project ID for asset storage, pass the brand value
      const scrapedAssets = await scrapeWebsite(websiteUrl, project.id, brand);
      setExtractedAssets(scrapedAssets);

      // Update project with extracted assets
      await createVersion({
        project_id: project.id,
        version_number: 1,
        created_by: user.id,
        is_current: true,
        html_content: getFallbackTemplate(scrapedAssets),
        marketing_content: ''
      });

      setCurrentStep('content');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to extract website assets. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !currentProject) return;
    setError(null);
    setIsLoading(true);

    try {
      const settings: ProjectSettings = {
        use_lorem_ipsum: useLorem,
        extracted_styles: extractedAssets || undefined,
        deployment: {
          platform: 'custom',
          settings: {},
        },
      };

      // Update project settings
      await supabase
        .from('projects')
        .update({ settings })
        .eq('id', currentProject.id);

      // Generate landing page content using AI
      const prompt = useLorem 
        ? `Create a landing page that uses lorem ipsum placeholder text for all marketing content.
        Additional instructions:
        ${additionalInstructions}`
          : `Create a landing page with the following content:
        ${marketingContent}

        Additional instructions:
        ${additionalInstructions}`;

      const generatedContent = await generateLandingPage(prompt, extractedAssets || undefined);

      if (generatedContent.error) {
        throw new Error(generatedContent.error);
      }

      // Create a new version with the generated content
      await createVersion({
        project_id: currentProject.id,
        version_number: 2,
        html_content: generatedContent.html,
        marketing_content: marketingContent,
        prompt_instructions: additionalInstructions,
        created_by: user.id,
        is_current: true,
      });

      navigate(`/project/${currentProject.id}`);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create project. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Steps */}
        <nav aria-label="Progress" className="mb-8">
          <ol className="flex items-center">
            {steps.map((step, index) => (
              <li
                key={step.id}
                className={`relative ${
                  index < steps.length - 1 ? 'pr-8 sm:pr-20' : ''
                }`}
              >
                <div className="flex items-center">
                  <div
                    className={`${
                      currentStep === step.id
                        ? 'border-indigo-600 bg-indigo-600'
                        : 'border-gray-300 bg-white'
                    } rounded-full border-2 p-2`}
                  >
                    <div
                      className={
                        currentStep === step.id
                          ? 'text-white'
                          : 'text-gray-500'
                      }
                    >
                      {step.icon}
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="hidden sm:block absolute top-0 right-0 h-full w-5">
                      <div className="h-0.5 relative top-4 bg-gray-300 w-full" />
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  <span className="text-sm font-medium text-gray-900">
                    {step.title}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </nav>

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

        {/* Step Content */}
        <div className="bg-white shadow-sm rounded-lg p-6">
          {currentStep === 'url' && (
            <div className="space-y-6">
              <div>
                <label
                  htmlFor="projectName"
                  className="block text-sm font-medium text-gray-700"
                >
                  Project Name
                </label>
                <input
                  type="text"
                  id="projectName"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="My Landing Page"
                />
              </div>
              <div>
                <label
                  htmlFor="websiteUrl"
                  className="block text-sm font-medium text-gray-700"
                >
                  Website URL
                </label>
                <input
                  type="text"
                  id="websiteUrl"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="https://example.com"
                />
                <label htmlFor="brand" className="block text-sm font-medium text-gray-700">
                  Brand (optional)
                </label>
                <input
                  type="text"
                  id="brand"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                <p className="mt-2 text-sm text-gray-500">
                  We'll extract styles and assets from this URL to match your
                  brand.
                </p>
              </div>
            </div>
          )}

          {currentStep === 'content' && (
            <div className="space-y-6">
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={useLorem}
                    onChange={(e) => setUseLorem(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Use Lorem Ipsum placeholder text
                  </span>
                </label>
              </div>
              {!useLorem && (
                <div>
                  <label
                    htmlFor="marketingContent"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Marketing Content
                  </label>
                  <textarea
                    id="marketingContent"
                    rows={6}
                    value={marketingContent}
                    onChange={(e) => setMarketingContent(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    placeholder="Enter your marketing content here..."
                  />
                </div>
              )}
            </div>
          )}

          {currentStep === 'settings' && (
            <div className="space-y-6">
              <div>
                <label
                  htmlFor="instructions"
                  className="block text-sm font-medium text-gray-700"
                >
                  Additional Instructions
                </label>
                <textarea
                  id="instructions"
                  rows={4}
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Any specific requirements or preferences..."
                />
              </div>
              {extractedAssets && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Extracted Assets
                  </h3>
                  <div className="bg-gray-50 rounded-md p-4">
                    <div className="mb-4">
                      <h4 className="text-xs font-medium text-gray-500 mb-2">
                        Colors
                      </h4>
                      <div className="flex gap-2">
                        {(extractedAssets.colors || []).map((color) => (
                          <div
                            key={color}
                            className="w-8 h-8 rounded-full border border-gray-200"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 mb-2">
                        Fonts
                      </h4>
                      <div className="flex gap-2">
                        {(extractedAssets.fonts || []).map((font) => (
                          <span
                            key={font}
                            className="inline-flex items-center px-2 py-1 rounded-md bg-white text-xs text-gray-700 border border-gray-200"
                          >
                            {font}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex justify-between">
            {currentStep !== 'url' && (
              <button
                type="button"
                onClick={() =>
                  setCurrentStep(currentStep === 'settings' ? 'content' : 'url')
                }
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                if (currentStep === 'url') {
                  handleUrlSubmit(e);
                } else if (currentStep === 'content') {
                  setCurrentStep('settings');
                } else {
                  handleSubmit();
                }
              }}
              disabled={isLoading}
              className="ml-auto inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : currentStep === 'settings' ? (
                <Wand2 className="h-4 w-4 mr-2" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              {currentStep === 'settings' ? 'Generate Landing Page' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NewProject;