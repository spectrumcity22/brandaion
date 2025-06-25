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

interface Client {
  id: string;
  auth_user_id: string;
  organisation_name: string;
  email?: string;
  created_at: string;
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
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [clientStats, setClientStats] = useState<Record<string, any>>({});

  useEffect(() => {
    loadStats();
  }, [selectedClientId]);

  const generateDirectoryStructure = (
    clients: Client[],
    staticObjects: DiscoveryObject[],
    faqObjects: FAQObject[],
    brands: any[],
    products: any[],
    selectedClientId: string
  ): DirectoryItem[] => {
    const structure: DirectoryItem[] = [];

    // Determine which clients to show
    const clientsToShow = selectedClientId === 'all' ? clients : clients.filter(c => c.auth_user_id === selectedClientId);

    for (const client of clientsToShow) {
      const clientStaticObjects = staticObjects.filter(obj => obj.client_organisation_id === client.id);
      const clientFaqObjects = faqObjects.filter(obj => obj.client_organisation_id === client.id);
      const clientBrands = brands.filter(brand => brand.organisation_id === client.id);
      const clientProducts = products.filter(product => product.organisation_id === client.id);

      // Organization folder
      const orgFolder: DirectoryItem = {
        name: client.organisation_name || 'Unnamed Organization',
        type: 'folder',
        path: `/${client.organisation_name || 'unnamed'}`,
        icon: '📁',
        color: clientStaticObjects.length > 0 ? 'text-green-500' : 'text-red-500',
        children: []
      };

      // Organization JSON-LD file
      const orgJsonld = clientStaticObjects.find(obj => obj.organization_jsonld);
      orgFolder.children!.push({
        name: 'organization.jsonld',
        type: 'file',
        path: `/${client.organisation_name || 'unnamed'}/organization.jsonld`,
        jsonData: orgJsonld?.organization_jsonld || null,
        icon: '📄',
        color: orgJsonld ? 'text-green-500' : 'text-red-500'
      });

      // Brands folder
      const brandsFolder: DirectoryItem = {
        name: 'brands',
        type: 'folder',
        path: `/${client.organisation_name || 'unnamed'}/brands`,
        icon: '📁',
        color: clientBrands.length > 0 ? 'text-green-500' : 'text-red-500',
        children: []
      };

      // Add brand files
      for (const brand of clientBrands) {
        const brandJsonld = clientStaticObjects.find(obj => obj.brand_jsonld);
        brandsFolder.children!.push({
          name: `${brand.brand_name || 'unnamed'}.jsonld`,
          type: 'file',
          path: `/${client.organisation_name || 'unnamed'}/brands/${brand.brand_name || 'unnamed'}.jsonld`,
          jsonData: brandJsonld?.brand_jsonld || null,
          icon: '📄',
          color: brandJsonld ? 'text-green-500' : 'text-red-500'
        });

        // Products subfolder for this brand
        const brandProducts = clientProducts.filter(product => product.brand_id === brand.id);
        if (brandProducts.length > 0) {
          const productsFolder: DirectoryItem = {
            name: 'products',
            type: 'folder',
            path: `/${client.organisation_name || 'unnamed'}/brands/${brand.brand_name || 'unnamed'}/products`,
            icon: '📁',
            color: 'text-green-500',
            children: []
          };

          for (const product of brandProducts) {
            const productJsonld = clientStaticObjects.find(obj => obj.product_jsonld);
            productsFolder.children!.push({
              name: `${product.product_name || 'unnamed'}.jsonld`,
              type: 'file',
              path: `/${client.organisation_name || 'unnamed'}/brands/${brand.brand_name || 'unnamed'}/products/${product.product_name || 'unnamed'}.jsonld`,
              jsonData: productJsonld?.product_jsonld || null,
              icon: '📄',
              color: productJsonld ? 'text-green-500' : 'text-red-500'
            });
          }

          brandsFolder.children!.push(productsFolder);
        }
      }

      orgFolder.children!.push(brandsFolder);

      // FAQs folder
      const faqsFolder: DirectoryItem = {
        name: 'faqs',
        type: 'folder',
        path: `/${client.organisation_name || 'unnamed'}/faqs`,
        icon: '📁',
        color: clientFaqObjects.length > 0 ? 'text-green-500' : 'text-red-500',
        children: []
      };

      // Add FAQ files
      for (const faq of clientFaqObjects) {
        faqsFolder.children!.push({
          name: `faq-${faq.week_start_date}.jsonld`,
          type: 'file',
          path: `/${client.organisation_name || 'unnamed'}/faqs/faq-${faq.week_start_date}.jsonld`,
          jsonData: faq.faq_json_object || null,
          icon: '📄',
          color: faq.faq_json_object ? 'text-green-500' : 'text-red-500'
        });
      }

      orgFolder.children!.push(faqsFolder);

      structure.push(orgFolder);
    }

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

      // Get all clients for admin view
      const { data: allClients, error: clientsError } = await supabase
        .from('client_organisation')
        .select('id, auth_user_id, organisation_name, created_at')
        .order('organisation_name', { ascending: true });

      if (clientsError) throw clientsError;
      setClients(allClients || []);

      // Build filter conditions based on selected client
      let staticFilter = supabase.from('llm_discovery_static').select('*');
      let faqFilter = supabase.from('llm_discovery_faq_objects').select('*');
      let brandsFilter = supabase.from('brands').select('*');
      let productsFilter = supabase.from('products').select('*');

      if (selectedClientId !== 'all') {
        // Filter by specific client's organization
        const selectedClient = allClients?.find(c => c.auth_user_id === selectedClientId);
        if (selectedClient) {
          staticFilter = staticFilter.eq('client_organisation_id', selectedClient.id);
          faqFilter = faqFilter.eq('client_organisation_id', selectedClient.id);
          brandsFilter = brandsFilter.eq('organisation_id', selectedClient.id);
          productsFilter = productsFilter.eq('organisation_id', selectedClient.id);
        }
      }

      // Get static objects
      const { data: staticObjects, error: staticError } = await staticFilter.order('last_generated', { ascending: false });
      if (staticError) throw staticError;

      // Get FAQ objects
      const { data: faqObjects, error: faqError } = await faqFilter.order('last_generated', { ascending: false });
      if (faqError) throw faqError;

      // Get brands
      const { data: brands, error: brandsError } = await brandsFilter.order('brand_name', { ascending: true });
      if (brandsError) throw brandsError;

      // Get products
      const { data: products, error: productsError } = await productsFilter.order('product_name', { ascending: true });
      if (productsError) throw productsError;

      // Calculate stats
      const totalStaticObjects = staticObjects?.length || 0;
      const totalFaqObjects = faqObjects?.length || 0;
      const organizationsWithJsonld = staticObjects?.filter(obj => obj.organization_jsonld)?.length || 0;
      const brandsWithJsonld = staticObjects?.filter(obj => obj.brand_jsonld)?.length || 0;
      const productsWithJsonld = staticObjects?.filter(obj => obj.product_jsonld)?.length || 0;

      // Get recent updates (last 10)
      const recentUpdates = [...(staticObjects || []), ...(faqObjects || [])]
        .sort((a, b) => new Date(b.last_generated || b.created_at).getTime() - new Date(a.last_generated || a.created_at).getTime())
        .slice(0, 10);

      setStats({
        total_static_objects: totalStaticObjects,
        total_faq_objects: totalFaqObjects,
        organizations_with_jsonld: organizationsWithJsonld,
        brands_with_jsonld: brandsWithJsonld,
        products_with_jsonld: productsWithJsonld,
        recent_updates: recentUpdates
      });

      // Generate directory structure
      const directoryStructure = generateDirectoryStructure(
        allClients || [],
        staticObjects || [],
        faqObjects || [],
        brands || [],
        products || [],
        selectedClientId
      );
      setDirectoryStructure(directoryStructure);

      // Calculate client stats for overview table
      await calculateClientStats(allClients || [], staticObjects || [], faqObjects || [], brands || [], products || []);

    } catch (error) {
      console.error('Error loading stats:', error);
      setError('Failed to load discovery data');
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

  // Function to calculate stats for each client
  const calculateClientStats = async (clients: Client[], staticObjects: DiscoveryObject[], faqObjects: FAQObject[], brands: any[], products: any[]) => {
    try {
      const stats: Record<string, any> = {};
      
      for (const client of clients) {
        // Get static objects for this client
        const clientStaticObjects = staticObjects.filter(obj => obj.client_organisation_id === client.id);
        const clientFaqObjects = faqObjects.filter(obj => obj.client_organisation_id === client.id);
        const clientBrands = brands.filter(brand => brand.organisation_id === client.id);
        const clientProducts = products.filter(product => product.organisation_id === client.id);

        // Calculate status
        let status = 'Inactive';
        let statusColor = 'text-red-500';
        
        if (clientStaticObjects.length > 0 || clientFaqObjects.length > 0) {
          if (clientStaticObjects.length > 0 && clientBrands.length > 0 && clientProducts.length > 0) {
            status = 'Complete';
            statusColor = 'text-green-500';
          } else {
            status = 'Partial';
            statusColor = 'text-yellow-500';
          }
        }

        stats[client.auth_user_id] = {
          staticObjects: clientStaticObjects.length,
          faqObjects: clientFaqObjects.length,
          brands: clientBrands.length,
          products: clientProducts.length,
          status,
          statusColor
        };
      }
      
      setClientStats(stats);
    } catch (error) {
      console.error('Error calculating client stats:', error);
    }
  };

  // Function to handle client selection from table
  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
  };

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

        {/* Client Filter */}
        <div className="mb-6 bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <label className="text-white font-medium">Filter by Client:</label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Clients</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.auth_user_id}>
                    {client.organisation_name}
                  </option>
                ))}
              </select>
              {selectedClientId !== 'all' && (
                <button
                  onClick={() => setSelectedClientId('all')}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg transition-colors text-sm"
                >
                  View All Clients
                </button>
              )}
            </div>
            <div className="text-sm text-gray-400">
              {selectedClientId === 'all' 
                ? `Showing data for all ${clients.length} clients`
                : `Showing data for ${clients.find(c => c.auth_user_id === selectedClientId)?.organisation_name || 'selected client'}`
              }
            </div>
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

        {/* Client Overview */}
        {selectedClientId === 'all' && (
          <div className="mb-8 bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4">📊 Client Overview</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Static Objects
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      FAQ Objects
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Brands
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Products
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {clients.map((client) => {
                    const stats = clientStats[client.auth_user_id] || {};
                    
                    return (
                      <tr 
                        key={client.id}
                        className="border-b border-gray-700 hover:bg-gray-700/30 cursor-pointer transition-colors"
                        onClick={() => setSelectedClientId(client.auth_user_id)}
                      >
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-white">{client.organisation_name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-300">{stats.staticObjects || 0}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-300">{stats.faqObjects || 0}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-300">{stats.brands || 0}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-300">{stats.products || 0}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className={`text-sm font-medium ${stats.statusColor || 'text-gray-400'}`}>
                            {stats.status || 'Unknown'}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-sm text-gray-400">
              💡 Click on any client row to filter and view their specific data
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