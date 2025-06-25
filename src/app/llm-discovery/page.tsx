"use client";

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface DiscoveryObject {
  id: string;
  auth_user_id: string;
  client_organisation_id: string;
  organization_jsonld: any;
  brand_jsonld: any;
  product_jsonld: any;
  last_generated: string;
  is_active: boolean;
}

interface FAQObject {
  id: string;
  batch_faq_pairs_id: string;
  auth_user_id: string;
  client_organisation_id: string;
  brand_id: string | null;
  product_id: string | null;
  week_start_date: string;
  faq_json_object: any;
  organization_jsonld: any;
  brand_jsonld: any;
  product_jsonld: any;
  last_generated: string;
}

interface DiscoveryStats {
  total_static_objects: number;
  total_faq_objects: number;
  organizations_with_jsonld: number;
  brands_with_jsonld: number;
  products_with_jsonld: number;
  recent_updates: (DiscoveryObject | FAQObject)[];
}

interface DirectoryItem {
  name: string;
  type: 'file' | 'folder';
  path: string;
  jsonData?: any;
  children?: DirectoryItem[];
  icon: string;
  color: string;
}

// Modal for editing file content
function EditFileModal({ file, onClose, onSave }: { file: DirectoryItem | null, onClose: () => void, onSave: (content: any) => void }) {
  const [content, setContent] = useState(file?.jsonData ? JSON.stringify(file.jsonData, null, 2) : '');
  useEffect(() => {
    setContent(file?.jsonData ? JSON.stringify(file.jsonData, null, 2) : '');
  }, [file]);
  if (!file) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-2xl p-6 relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-400 hover:text-white">✕</button>
        <h3 className="text-lg font-semibold text-white mb-2">Edit {file.name}</h3>
        <div className="mb-4 text-xs text-gray-400">Path: {file.path}</div>
        <textarea
          className="w-full h-64 p-2 bg-gray-800 text-gray-200 font-mono rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={content}
          onChange={e => setContent(e.target.value)}
        />
        <div className="flex justify-end mt-4 gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded bg-gray-700 text-gray-300 hover:bg-gray-600">Cancel</button>
          <button onClick={() => onSave(content)} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Save</button>
        </div>
      </div>
    </div>
  );
}

// Helper to determine file status
function getFileStatus(file: DirectoryItem): 'red' | 'amber' | 'green' {
  if (!file.jsonData) return 'red';
  if (file.name.endsWith('.jsonld')) {
    // Example: check for required fields
    try {
      const data = typeof file.jsonData === 'string' ? JSON.parse(file.jsonData) : file.jsonData;
      if (!data || Object.keys(data).length === 0) return 'red';
      if (data['@type'] && data['@type'].toLowerCase().includes('organization') && !data['industry']) return 'amber';
      if (data['@type'] && data['@type'].toLowerCase().includes('product') && !data['name']) return 'amber';
      // Add more checks as needed
    } catch {
      return 'amber';
    }
  }
  // If last_updated is too old, mark as amber
  if (file.jsonData?.last_updated) {
    const last = new Date(file.jsonData.last_updated);
    if (Date.now() - last.getTime() > 1000 * 60 * 60 * 24 * 30) return 'amber'; // >30 days old
  }
  return 'green';
}

export default function LLMDiscoveryDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DiscoveryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [regenerationResults, setRegenerationResults] = useState<any>(null);
  const [directoryStructure, setDirectoryStructure] = useState<DirectoryItem[]>([]);
  const [hoveredItem, setHoveredItem] = useState<DirectoryItem | null>(null);
  const [showDirectoryPanel, setShowDirectoryPanel] = useState(true);
  const [editingFile, setEditingFile] = useState<DirectoryItem | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const generateDirectoryStructure = (
    staticObjects: DiscoveryObject[],
    faqObjects: FAQObject[],
    brands: any[],
    products: any[]
  ) => {
    const structure: DirectoryItem[] = [
      {
        name: 'data',
        type: 'folder',
        path: '/data',
        icon: '📁',
        color: 'text-blue-400',
        children: [
          {
            name: 'platform-llms.txt',
            type: 'file',
            path: '/data/platform-llms.txt',
            icon: '📄',
            color: 'text-green-400',
            jsonData: {
              description: 'Platform-level LLM discovery index',
              content: 'Contains all available LLM providers and their capabilities',
              last_updated: new Date().toISOString()
            }
          },
          {
            name: 'organizations',
            type: 'folder',
            path: '/data/organizations',
            icon: '🏢',
            color: 'text-purple-400',
            children: []
          }
        ]
      }
    ];

    // For each organization
    staticObjects.forEach(org => {
      const orgName = org.organization_jsonld?.name || 'organization';
      const orgSlug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const orgBrands = brands.filter(b => b.organisation_id === org.client_organisation_id);
      const orgFolder: DirectoryItem = {
        name: orgSlug,
        type: 'folder',
        path: `/data/organizations/${orgSlug}`,
        icon: '🏢',
        color: 'text-purple-400',
        children: [
          {
            name: 'organization-llms.txt',
            type: 'file',
            path: `/data/organizations/${orgSlug}/organization-llms.txt`,
            icon: '📄',
            color: 'text-green-400',
            jsonData: {
              description: 'Organization-specific LLM discovery index',
              organization: orgName,
              last_updated: org.last_generated
            }
          },
          {
            name: 'organization.jsonld',
            type: 'file',
            path: `/data/organizations/${orgSlug}/organization.jsonld`,
            icon: '🔗',
            color: 'text-yellow-400',
            jsonData: org.organization_jsonld || {
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": orgName,
              "description": "Organization JSON-LD data"
            }
          },
          {
            name: 'brands',
            type: 'folder',
            path: `/data/organizations/${orgSlug}/brands`,
            icon: '🏷️',
            color: 'text-orange-400',
            children: []
          }
        ]
      };
      const brandsFolder = orgFolder.children?.find(c => c.name === 'brands' && c.type === 'folder');
      if (brandsFolder && brandsFolder.children) {
        orgBrands.forEach(brand => {
          const brandSlug = brand.brand_name.toLowerCase().replace(/[^a-z0-9]/g, '-');
          const brandProducts = products.filter(p => p.brand_id === brand.id);
          const brandFolder: DirectoryItem = {
            name: brandSlug,
            type: 'folder',
            path: `/data/organizations/${orgSlug}/brands/${brandSlug}`,
            icon: '🏷️',
            color: 'text-orange-400',
            children: [
              {
                name: 'brands-llms.txt',
                type: 'file',
                path: `/data/organizations/${orgSlug}/brands/${brandSlug}/brands-llms.txt`,
                icon: '📄',
                color: 'text-green-400',
                jsonData: {
                  description: 'Brand-specific LLM discovery index',
                  brand: brand.brand_name,
                  last_updated: brand.updated_at || brand.created_at
                }
              },
              {
                name: 'brand.jsonld',
                type: 'file',
                path: `/data/organizations/${orgSlug}/brands/${brandSlug}/brand.jsonld`,
                icon: '🔗',
                color: 'text-yellow-400',
                jsonData: brand.brand_jsonld_object
              },
              {
                name: 'products',
                type: 'folder',
                path: `/data/organizations/${orgSlug}/brands/${brandSlug}/products`,
                icon: '📦',
                color: 'text-red-400',
                children: []
              }
            ]
          };
          const productsFolder = brandFolder.children?.find(c => c.name === 'products' && c.type === 'folder');
          if (productsFolder && productsFolder.children) {
            brandProducts.forEach(product => {
              const productSlug = product.product_name.toLowerCase().replace(/[^a-z0-9]/g, '-');
              const productFaqs = faqObjects.filter(faq => faq.product_id === product.id);
              const productFolder: DirectoryItem = {
                name: productSlug,
                type: 'folder',
                path: `/data/organizations/${orgSlug}/brands/${brandSlug}/products/${productSlug}`,
                icon: '📦',
                color: 'text-red-400',
                children: [
                  {
                    name: 'products-llms.txt',
                    type: 'file',
                    path: `/data/organizations/${orgSlug}/brands/${brandSlug}/products/${productSlug}/products-llms.txt`,
                    icon: '📄',
                    color: 'text-green-400',
                    jsonData: {
                      description: 'Product-specific LLM discovery index',
                      product: product.product_name,
                      last_updated: product.updated_at || product.inserted_at
                    }
                  },
                  {
                    name: 'product.jsonld',
                    type: 'file',
                    path: `/data/organizations/${orgSlug}/brands/${brandSlug}/products/${productSlug}/product.jsonld`,
                    icon: '🔗',
                    color: 'text-yellow-400',
                    jsonData: product.schema_json
                  },
                  {
                    name: 'faqs',
                    type: 'folder',
                    path: `/data/organizations/${orgSlug}/brands/${brandSlug}/products/${productSlug}/faqs`,
                    icon: '❓',
                    color: 'text-cyan-400',
                    children: []
                  }
                ]
              };
              // Add FAQ file if exists
              if (productFaqs.length > 0) {
                const faqFile: DirectoryItem = {
                  name: 'faq.jsonld',
                  type: 'file',
                  path: `/data/organizations/${orgSlug}/brands/${brandSlug}/products/${productSlug}/faqs/faq.jsonld`,
                  icon: '🔗',
                  color: 'text-yellow-400',
                  jsonData: productFaqs[0].faq_json_object || {
                    description: 'FAQ data for this product',
                    faq_count: productFaqs.length,
                    last_updated: productFaqs[0].last_generated
                  }
                };
                const faqsFolder = (productFolder.children ?? []).find(child => child.name === 'faqs' && child.type === 'folder');
                if (faqsFolder && faqsFolder.children) {
                  faqsFolder.children.push(faqFile);
                }
              }
              if (productsFolder && productsFolder.children) {
                productsFolder.children.push(productFolder);
              }
            });
          }
        });
      }
      // Only push orgFolder after all brands are added
      if (
        Array.isArray(structure[0].children) &&
        structure[0].children[1] &&
        Array.isArray(structure[0].children[1].children)
      ) {
        structure[0].children[1].children.push(orgFolder);
      }
    });
    return structure;
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Get static objects
      const { data: staticObjects, error: staticError } = await supabase
        .from('llm_discovery_static')
        .select('*')
        .eq('auth_user_id', user.id)
        .order('last_generated', { ascending: false });

      if (staticError) throw staticError;

      // Get FAQ objects
      const { data: faqObjects, error: faqError } = await supabase
        .from('llm_discovery_faq_objects')
        .select('*')
        .eq('auth_user_id', user.id)
        .order('last_generated', { ascending: false });

      if (faqError) throw faqError;

      // Calculate stats
      const stats: DiscoveryStats = {
        total_static_objects: staticObjects?.length || 0,
        total_faq_objects: faqObjects?.length || 0,
        organizations_with_jsonld: staticObjects?.filter(obj => obj.organization_jsonld)?.length || 0,
        brands_with_jsonld: staticObjects?.filter(obj => obj.brand_jsonld)?.length || 0,
        products_with_jsonld: staticObjects?.filter(obj => obj.product_jsonld)?.length || 0,
        recent_updates: [...(staticObjects || []), ...(faqObjects || [])]
          .sort((a, b) => new Date(b.last_generated).getTime() - new Date(a.last_generated).getTime())
          .slice(0, 10)
      };

      setStats(stats);

      // Generate directory structure
      const directoryStructure = generateDirectoryStructure(staticObjects || [], faqObjects || [], [], []);
      setDirectoryStructure(directoryStructure);

    } catch (err) {
      console.error('Error loading stats:', err);
      setError('Failed to load discovery stats');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateAll = async () => {
    if (!confirm('This will regenerate all LLM discovery objects. This may take a few minutes. Continue?')) {
      return;
    }

    try {
      setRegenerating(true);
      setError('');
      setSuccess('');
      
      const response = await fetch('/api/llm-discovery/regenerate-all', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('All LLM discovery objects regenerated successfully!');
        setRegenerationResults(data.results);
        await loadStats(); // Refresh stats
      } else {
        setError(data.error || 'Failed to regenerate objects');
      }
    } catch (err) {
      console.error('Error regenerating objects:', err);
      setError('Failed to regenerate objects');
    } finally {
      setRegenerating(false);
    }
  };

  const handleRegeneratePlatformIndex = async () => {
    try {
      setError('');
      setSuccess('');
      
      const response = await fetch('/api/llm-discovery/platform-index', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Platform index regenerated successfully!');
        await loadStats(); // Refresh stats
      } else {
        setError(data.error || 'Failed to regenerate platform index');
      }
    } catch (err) {
      console.error('Error regenerating platform index:', err);
      setError('Failed to regenerate platform index');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getObjectTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'static': 'bg-blue-500/20 text-blue-400',
      'faq': 'bg-green-500/20 text-green-400',
    };
    return colors[type] || 'bg-gray-500/20 text-gray-400';
  };

  // 1. Define the schema skeleton for the directory structure
  const schemaSkeleton = {
    name: 'data',
    type: 'folder',
    children: [
      { name: 'platform-llms.txt', type: 'file' },
      {
        name: 'organizations',
        type: 'folder',
        children: [
          {
            name: '[org-slug]',
            type: 'folder',
            children: [
              { name: 'organization-llms.txt', type: 'file' },
              { name: 'organization.jsonld', type: 'file' },
              {
                name: 'brands',
                type: 'folder',
                children: [
                  {
                    name: '[brand-slug]',
                    type: 'folder',
                    children: [
                      { name: 'brands-llms.txt', type: 'file' },
                      { name: 'brand.jsonld', type: 'file' },
                      {
                        name: 'products',
                        type: 'folder',
                        children: [
                          {
                            name: '[product-slug]',
                            type: 'folder',
                            children: [
                              { name: 'products-llms.txt', type: 'file' },
                              { name: 'product.jsonld', type: 'file' },
                              {
                                name: 'faqs',
                                type: 'folder',
                                children: [
                                  { name: 'faq.jsonld', type: 'file' }
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  // 2. Merge real data with the skeleton, marking missing nodes as red
  function mergeWithSkeleton(skeleton: any, data: any, level = 0): any {
    // If skeleton is a file, try to find it in data.children
    if (skeleton.type === 'file') {
      const found = data?.children?.find((child: any) => child.name === skeleton.name && child.type === 'file');
      return found
        ? { ...found, status: getFileStatus(found) }
        : { ...skeleton, status: 'red', path: data?.path ? `${data.path}/${skeleton.name}` : skeleton.name };
    }
    // If skeleton is a folder, try to find it in data.children
    let folderData = data?.children?.find((child: any) => child.name === skeleton.name && child.type === 'folder');
    // For slug folders, match any folder if not found
    if (!folderData && skeleton.name.startsWith('[') && skeleton.name.endsWith(']')) {
      // If there are any folders at this level, merge them all
      const allFolders = (data?.children || []).filter((child: any) => child.type === 'folder' && child.name !== skeleton.name);
      if (allFolders.length > 0) {
        return allFolders.map((f: any) => mergeWithSkeleton({ ...skeleton, name: f.name }, f, level + 1));
      } else {
        // No folders, show placeholder
        return [{ ...skeleton, status: 'red', path: data?.path ? `${data.path}/${skeleton.name}` : skeleton.name, children: (skeleton.children || []).map((c: any) => mergeWithSkeleton(c, {}, level + 1)) }];
      }
    }
    // If folderData found, merge its children
    if (folderData) {
      return {
        ...folderData,
        status: 'green',
        children: (skeleton.children || []).flatMap((c: any) => mergeWithSkeleton(c, folderData, level + 1)),
      };
    } else {
      // Folder missing, show placeholder with all children as missing
      return {
        ...skeleton,
        status: 'red',
        path: data?.path ? `${data.path}/${skeleton.name}` : skeleton.name,
        children: (skeleton.children || []).map((c: any) => mergeWithSkeleton(c, {}, level + 1)),
      };
    }
  }

  // 3. Robust ASCII tree renderer
  function renderAsciiTree(nodes: any, prefix = '', isLast = true, level = 0): any {
    if (!Array.isArray(nodes)) nodes = [nodes];
    return nodes.map((node: any, idx: any) => {
      const last = idx === nodes.length - 1;
      const branch = level === 0 ? '' : (last ? '└── ' : '├── ');
      const nextPrefix = level === 0 ? '' : prefix + (last ? '    ' : '│   ');
      let colorClass = '';
      if (node.status === 'red') colorClass = 'text-red-400 font-bold';
      else if (node.status === 'amber') colorClass = 'text-yellow-400 font-semibold';
      else if (node.status === 'green') colorClass = 'text-green-400 font-semibold';
      return (
        <div key={node.path || node.name + level + idx}>
          <div
            className={`font-mono text-xs flex items-center py-0.5 px-2 rounded transition-colors ${colorClass}`}
            style={{ paddingLeft: `${level * 20 + 8}px` }}
          >
            <span className="whitespace-pre">{prefix}{branch}</span>
            {node.type === 'file' ? (
              <span
                className={colorClass + ' underline cursor-pointer'}
                title={node.status === 'red' ? 'Missing or invalid' : node.status === 'amber' ? 'Needs attention' : 'Fit for purpose'}
                onClick={() => setEditingFile(node)}
              >
                {node.name}
              </span>
            ) : (
              <span className={colorClass}>{node.name}</span>
            )}
          </div>
          {node.children && node.children.length > 0 && renderAsciiTree(node.children, nextPrefix, last, level + 1)}
        </div>
      );
    });
  }

  const renderJSONPreview = () => {
    if (!hoveredItem || !hoveredItem.jsonData) return null;

    return (
      <div className="absolute right-0 top-0 w-96 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white font-semibold text-sm">{hoveredItem.name}</h4>
          <span className="text-gray-400 text-xs">{hoveredItem.type}</span>
        </div>
        <div className="bg-gray-800 rounded p-3 max-h-64 overflow-y-auto">
          <pre className="text-xs text-gray-300 whitespace-pre-wrap">
            {JSON.stringify(hoveredItem.jsonData, null, 2)}
          </pre>
        </div>
        <div className="mt-2 text-xs text-gray-400">
          Path: {hoveredItem.path}
        </div>
      </div>
    );
  };

  function getEditableFilesFromDirectory(items: DirectoryItem[]): DirectoryItem[] {
    let files: DirectoryItem[] = [];
    for (const item of items) {
      if (item.type === 'file' && (item.name.endsWith('.jsonld') || item.name.endsWith('-llms.txt'))) {
        files.push(item);
      }
      if (item.children && item.children.length > 0) {
        files = files.concat(getEditableFilesFromDirectory(item.children));
      }
    }
    return files;
  }

  // In the main component, after loading data and building directoryStructure:
  const mergedTree = mergeWithSkeleton(schemaSkeleton, directoryStructure[0] || {});

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading LLM Discovery Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">LLM Discovery System</h1>
              <p className="text-gray-400">Manage LLM-friendly discovery objects and JSON-LD structured data</p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-900/20 border border-green-500/50 rounded-lg">
            <p className="text-green-400">{success}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={handleRegenerateAll}
            disabled={regenerating}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:transform-none"
          >
            {regenerating ? 'Regenerating...' : '🔄 Regenerate All Objects'}
          </button>
          
          <button
            onClick={handleRegeneratePlatformIndex}
            className="bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105"
          >
            📋 Regenerate Platform Index
          </button>

          <button
            onClick={() => router.push('/llm-discovery-construction')}
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105"
          >
            🚧 Construction Page
          </button>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <div className="text-3xl font-bold text-white mb-2">{stats.total_static_objects}</div>
              <div className="text-gray-400">Static Objects</div>
            </div>
            
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <div className="text-3xl font-bold text-blue-400 mb-2">{stats.total_faq_objects}</div>
              <div className="text-gray-400">FAQ Objects</div>
            </div>
            
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <div className="text-3xl font-bold text-green-400 mb-2">{stats.organizations_with_jsonld}</div>
              <div className="text-gray-400">With Org JSON-LD</div>
            </div>
            
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <div className="text-3xl font-bold text-purple-400 mb-2">{stats.brands_with_jsonld}</div>
              <div className="text-gray-400">With Brand JSON-LD</div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <div className="text-3xl font-bold text-orange-400 mb-2">{stats.products_with_jsonld}</div>
              <div className="text-gray-400">With Product JSON-LD</div>
            </div>
          </div>
        )}

        {/* Directory Structure Panel */}
        <div className="mb-8 bg-gray-800/50 border border-gray-700 rounded-lg p-6 relative">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white">📁 Directory Structure Mockup</h3>
            <button
              onClick={() => setShowDirectoryPanel(!showDirectoryPanel)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              {showDirectoryPanel ? 'Hide' : 'Show'} Panel
            </button>
          </div>
          
          {showDirectoryPanel && (
            <div className="relative">
              <div className="bg-gray-900/50 border border-gray-600 rounded-lg p-4 max-h-96 overflow-y-auto">
                <div className="text-sm text-gray-400 mb-3">
                  Hover over items to view JSON data
                </div>
                {renderAsciiTree(mergedTree)}
              </div>
              {renderJSONPreview()}
            </div>
          )}
        </div>

        {/* Recent Updates */}
        {stats && stats.recent_updates.length > 0 && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Recent Updates</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Organization JSON-LD
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Brand JSON-LD
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Product JSON-LD
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Last Generated
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {stats.recent_updates.map((obj) => (
                    <tr key={obj.id} className="hover:bg-gray-700/30">
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getObjectTypeColor('static' in obj ? 'static' : 'faq')}`}>
                          {'static' in obj ? 'Static' : 'FAQ'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-300 font-mono">{obj.id.slice(0, 8)}...</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={obj.organization_jsonld ? 'text-green-400' : 'text-red-400'}>
                          {obj.organization_jsonld ? '✅' : '❌'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={obj.brand_jsonld ? 'text-green-400' : 'text-red-400'}>
                          {obj.brand_jsonld ? '✅' : '❌'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={obj.product_jsonld ? 'text-green-400' : 'text-red-400'}>
                          {obj.product_jsonld ? '✅' : '❌'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-300">{formatDate(obj.last_generated)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-8 bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Quick Links</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/api/llm-discovery/platform-index"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg hover:bg-blue-500/30 transition-colors"
            >
              <span className="text-blue-400">Platform Index</span>
              <span className="text-blue-400">→</span>
            </a>
            
            <a
              href="/api/llm-discovery/organization/brandaion/organization-llms.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-green-500/20 border border-green-500/50 rounded-lg hover:bg-green-500/30 transition-colors"
            >
              <span className="text-green-400">Brandaion Index</span>
              <span className="text-green-400">→</span>
            </a>

            <a
              href="/api/llm-discovery/organization/brandaion/organization.jsonld"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-purple-500/20 border border-purple-500/50 rounded-lg hover:bg-purple-500/30 transition-colors"
            >
              <span className="text-purple-400">Brandaion JSON-LD</span>
              <span className="text-purple-400">→</span>
            </a>
          </div>
        </div>

        {/* Editable Files Panel */}
        <div className="mt-8 bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Editable Files</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {getEditableFilesFromDirectory(directoryStructure).map((file) => (
              <div key={file.path} className="bg-gray-700/50 border border-gray-600 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-white mb-2">{file.name}</h4>
                <div className="text-xs text-gray-400">
                  Last Updated: {formatDate(file.jsonData?.last_updated || '')}
                </div>
                <div className="text-xs text-gray-400">
                  Path: {file.path}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Edit File Modal */}
        {editingFile && (
          <EditFileModal file={editingFile} onClose={() => setEditingFile(null)} onSave={() => setEditingFile(null)} />
        )}
      </div>
    </div>
  );
} 