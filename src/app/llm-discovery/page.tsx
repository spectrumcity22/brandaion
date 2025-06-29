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
  organisation_jsonld: any;
  organisation_jsonld_enriched: any;
  brand_jsonld: any;
  brand_jsonld_enriched: any;
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
  organisation_jsonld: any;
  brand_jsonld: any;
  product_jsonld: any;
  last_generated: string;
}

interface DiscoveryStats {
  total_static_objects: number;
  total_faq_objects: number;
  organisations_with_jsonld: number;
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
    console.log('EditFileModal - file received:', file);
    console.log('EditFileModal - jsonData:', file?.jsonData);
    console.log('EditFileModal - file name:', file?.name);
    console.log('EditFileModal - file path:', file?.path);
    console.log('EditFileModal - jsonData type:', typeof file?.jsonData);
    console.log('EditFileModal - jsonData keys:', file?.jsonData ? Object.keys(file.jsonData) : 'N/A');
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
          <button
            onClick={async () => {
              const res = await fetch('/api/write-to-github', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  filePath: file.path.replace(/^\//, ''),
                  fileContent: content,
                  commitMessage: `Edit ${file.name} via LLM Discovery UI`
                })
              });
              const result = await res.json();
              if (result.success) {
                alert('File written to GitHub!');
              } else {
                alert('Error writing file: ' + (result.error || 'Unknown error'));
              }
            }}
            className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 ml-2"
          >
            Write to Directory
          </button>
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
      if (data['@type'] && data['@type'].toLowerCase().includes('organisation') && !data['industry']) return 'amber';
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

// Helper to make safe file/folder names
function toSafeName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-_]/g, '');
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
    const clientsToShow = selectedClientId === 'all' ? clients : clients.filter(c => c.auth_user_id === selectedClientId);
    for (const client of clientsToShow) {
      const clientStaticObjects = staticObjects.filter(obj => obj.client_organisation_id === client.id);
      const clientFaqObjects = faqObjects.filter(obj => obj.client_organisation_id === client.id);
      const clientBrands = brands.filter(brand => brand.organisation_id === client.id);
      const clientProducts = products.filter(product => product.organisation_id === client.id);
      
      const orgFolder: DirectoryItem = {
        name: client.organisation_name || 'Unnamed Organisation',
        type: 'folder',
        path: `/${client.organisation_name || 'unnamed'}`,
        icon: '📁',
        color: 'text-white',
        children: []
      };
      
      // Organisation JSON-LD file - use enriched version if available
      const orgJsonld = clientStaticObjects.find(obj => obj.organisation_jsonld_enriched)?.organisation_jsonld_enriched || 
                       clientStaticObjects.find(obj => obj.organisation_jsonld)?.organisation_jsonld;
      
      // Debug logging
      console.log(`Client: ${client.organisation_name}`);
      console.log(`Static objects for this client:`, clientStaticObjects);
      console.log(`Has enriched org JSON-LD:`, clientStaticObjects.find(obj => obj.organisation_jsonld_enriched) ? 'YES' : 'NO');
      console.log(`Using enriched org JSON-LD:`, orgJsonld ? 'YES' : 'NO');
      console.log(`Enriched org JSON-LD data:`, clientStaticObjects.find(obj => obj.organisation_jsonld_enriched)?.organisation_jsonld_enriched);
      console.log(`Original org JSON-LD data:`, clientStaticObjects.find(obj => obj.organisation_jsonld)?.organisation_jsonld);
      console.log(`Final org JSON-LD being used:`, orgJsonld);
      
      orgFolder.children!.push({
        name: `organisation.jsonld`,
        type: 'file',
        path: `/${client.organisation_name || 'unnamed'}/organisation.jsonld`,
        jsonData: orgJsonld,
        icon: '📄',
        color: orgJsonld ? 'text-green-500' : 'text-red-500'
      });
      
      // Brands folder
      const brandsFolder: DirectoryItem = {
        name: 'brands',
        type: 'folder',
        path: `/${client.organisation_name || 'unnamed'}/brands`,
        icon: '📁',
        color: 'text-white',
        children: []
      };
      
      for (const brand of clientBrands) {
        // Use enriched brand JSON-LD if available, fallback to basic brand JSON-LD
        const brandJsonld = clientStaticObjects.find(obj => obj.brand_jsonld_enriched)?.brand_jsonld_enriched || 
                           clientStaticObjects.find(obj => obj.brand_jsonld)?.brand_jsonld;
        const safeBrandName = toSafeName(brand.brand_name || 'unnamed');
        const brandFolder: DirectoryItem = {
          name: safeBrandName,
          type: 'folder',
          path: `/${client.organisation_name || 'unnamed'}/brands/${safeBrandName}`,
          icon: '🏷️',
          color: 'text-white',
          children: []
        };
        
        // Brand JSON-LD file - use enriched version if available
        brandFolder.children!.push({
          name: `${safeBrandName}-brand.jsonld`,
          type: 'file',
          path: `/${client.organisation_name || 'unnamed'}/brands/${safeBrandName}/${safeBrandName}-brand.jsonld`,
          jsonData: brandJsonld,
          icon: '📄',
          color: brandJsonld ? 'text-green-500' : 'text-red-500'
        });
        
        // Products subfolder for this brand
        const brandProducts = clientProducts.filter(product => product.brand_id === brand.id);
        if (brandProducts.length > 0) {
          const productsFolder: DirectoryItem = {
            name: 'products',
            type: 'folder',
            path: `/${client.organisation_name || 'unnamed'}/brands/${safeBrandName}/products`,
            icon: '📁',
            color: 'text-white',
            children: []
          };
          
          for (const product of brandProducts) {
            // Get product JSON-LD from static objects first, fallback to schema_json
            const productJsonld = clientStaticObjects.find(obj => obj.product_jsonld)?.product_jsonld || 
                                 (product.schema_json ? JSON.parse(product.schema_json) : null);
            
            // Use a better product name - avoid "FAQ Pairs" or similar incorrect names
            let productName = product.product_name || 'unnamed';
            if (productName.toLowerCase().includes('faq') || productName.toLowerCase().includes('pairs')) {
              productName = 'product'; // Use generic name if the product name is incorrect
            }
            
            // Create a product folder for each product
            const safeProductName = toSafeName(product.product_name || 'unnamed');
            const productFolder: DirectoryItem = {
              name: safeProductName,
              type: 'folder',
              path: `/${client.organisation_name || 'unnamed'}/brands/${safeBrandName}/products/${safeProductName}`,
              icon: '📁',
              color: 'text-white',
              children: []
            };
            
            // Product JSON-LD file
            productFolder.children!.push({
              name: `${safeProductName}-product.jsonld`,
              type: 'file',
              path: `/${client.organisation_name || 'unnamed'}/brands/${safeBrandName}/products/${safeProductName}/${safeProductName}-product.jsonld`,
              jsonData: productJsonld,
              icon: '📄',
              color: productJsonld ? 'text-green-500' : 'text-red-500'
            });
            
            // FAQ files for this product - place them under the product
            const productFaqs = clientFaqObjects.filter(faq => faq.product_id === product.id);
            if (productFaqs.length > 0) {
              const faqsFolder: DirectoryItem = {
                name: 'faqs',
                type: 'folder',
                path: `/${client.organisation_name || 'unnamed'}/brands/${safeBrandName}/products/${safeProductName}/faqs`,
                icon: '📁',
                color: 'text-white',
                children: []
              };
              
              for (const faq of productFaqs) {
                faqsFolder.children!.push({
                  name: `faq-${faq.week_start_date}.jsonld`,
                  type: 'file',
                  path: `/${client.organisation_name || 'unnamed'}/brands/${safeBrandName}/products/${safeProductName}/faqs/faq-${faq.week_start_date}.jsonld`,
                  jsonData: faq.faq_json_object || null,
                  icon: '📄',
                  color: faq.faq_json_object ? 'text-green-500' : 'text-red-500'
                });
              }
              
              productFolder.children!.push(faqsFolder);
            }
            
            // Add the product folder to the products folder
            productsFolder.children!.push(productFolder);
          }
          
          brandFolder.children!.push(productsFolder);
        }
        
        brandsFolder.children!.push(brandFolder);
      }
      
      orgFolder.children!.push(brandsFolder);
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
        // Filter by specific client's organisation
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
      const organisationsWithJsonld = staticObjects?.filter(obj => obj.organisation_jsonld)?.length || 0;
      const brandsWithJsonld = staticObjects?.filter(obj => obj.brand_jsonld)?.length || 0;
      const productsWithJsonld = staticObjects?.filter(obj => obj.product_jsonld)?.length || 0;

      // Get recent updates (last 10)
      const recentUpdates = [...(staticObjects || []), ...(faqObjects || [])]
        .sort((a, b) => new Date(b.last_generated || b.created_at).getTime() - new Date(a.last_generated || a.created_at).getTime())
        .slice(0, 10);

      setStats({
        total_static_objects: totalStaticObjects,
        total_faq_objects: totalFaqObjects,
        organisations_with_jsonld: organisationsWithJsonld,
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
        name: 'organisations',
        type: 'folder',
        children: [
          {
            name: '[org-slug]',
            type: 'folder',
            children: [
              { name: 'organisation-llms.txt', type: 'file' },
              { name: 'organisation.jsonld', type: 'file' },
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

  // 3. Robust ASCII tree renderer with hover/click and color coding
  function renderAsciiTree(nodes: any, prefix = '', isLast = true, level = 0): any {
    if (!Array.isArray(nodes)) nodes = [nodes];
    return nodes.map((node: any, idx: any) => {
      const last = idx === nodes.length - 1;
      const branch = level === 0 ? '' : (last ? '└── ' : '├── ');
      const nextPrefix = level === 0 ? '' : prefix + (last ? '    ' : '│   ');
      // Only color code files
      let colorClass = '';
      if (node.type === 'file') {
        const status = getFileStatus(node);
        if (status === 'red') colorClass = 'text-red-400 font-bold';
        else if (status === 'amber') colorClass = 'text-yellow-400 font-semibold';
        else if (status === 'green') colorClass = 'text-green-400 font-semibold';
      } else {
        colorClass = 'text-white'; // Folders are white
      }
      return (
        <div key={node.path || node.name + level + idx}>
          <div
            className={`font-mono text-xs flex items-center py-0.5 px-2 rounded transition-colors ${colorClass}`}
            style={{ paddingLeft: `${level * 20 + 8}px` }}
            onMouseEnter={() => setHoveredItem(node)}
            onMouseLeave={() => setHoveredItem(null)}
            onClick={() => node.type === 'file' ? setEditingFile(node) : undefined}
          >
            <span className="whitespace-pre">{prefix}{branch}</span>
            <span className={node.type === 'file' ? colorClass + ' underline cursor-pointer' : colorClass}>
              {node.name}
            </span>
          </div>
          {node.children && node.children.length > 0 && renderAsciiTree(node.children, nextPrefix, last, level + 1)}
        </div>
      );
    });
  }

  // JSON preview side panel
  const renderJSONPreview = () => {
    if (!hoveredItem || !hoveredItem.jsonData) return null;
    return (
      <div className="fixed right-8 top-32 w-96 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 p-4">
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

  const handleSaveFile = async (content: any) => {
    if (!editingFile) return;
    
    try {
      // Parse the JSON content
      const jsonData = JSON.parse(content);
      
      // Here you would typically save to the database
      // For now, we'll just close the modal and show a success message
      setSuccess(`File ${editingFile.name} updated successfully!`);
      setEditingFile(null);
      
      // Reload stats to reflect changes
      await loadStats();
    } catch (error) {
      setError('Invalid JSON format. Please check your syntax.');
    }
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
              <div className="text-3xl font-bold text-green-400 mb-2">{stats.organisations_with_jsonld}</div>
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
        <div className="bg-gray-900/70 border border-gray-800 rounded-lg p-4 mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-white flex items-center">
              <span className="mr-2">📁</span> Directory Structure
            </h2>
            <button
              className="text-gray-400 hover:text-white text-xs"
              onClick={() => setShowDirectoryPanel(false)}
            >
              Hide Panel
            </button>
          </div>
          <div className="text-gray-400 text-xs mb-2">Click or hover over items to view JSON data</div>
          <div className="font-mono text-sm bg-black/40 rounded p-4 overflow-x-auto relative">
            {directoryStructure.length === 0 ? (
              <div className="text-red-400">No directory data found for this client.</div>
            ) : (
              renderAsciiTree(directoryStructure)
            )}
            {renderJSONPreview()}
          </div>
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
                      Organisation JSON-LD
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
                        <span className={obj.organisation_jsonld ? 'text-green-400' : 'text-red-400'}>
                          {obj.organisation_jsonld ? '✅' : '❌'}
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
              href="/api/llm-discovery/organisation/brandaion/organisation-llms.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              organisation-llms.txt
            </a>

            <a
              href="/api/llm-discovery/organisation/brandaion/organisation.jsonld"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              organisation.jsonld
            </a>
          </div>
        </div>

        {/* Editable Files Panel */}
        <div className="mt-8 bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Editable Files</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {getEditableFilesFromDirectory(directoryStructure).map((file) => (
              <div key={file.path} className="bg-gray-700/50 border border-gray-600 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-white">{file.name}</h4>
                  <button
                    onClick={() => setEditingFile(file)}
                    className="text-gray-400 hover:text-white transition-colors"
                    title="Edit file"
                  >
                    ⚙️
                  </button>
                </div>
                <div className="text-xs text-gray-400">
                  Last Updated: {formatDate(file.jsonData?.last_updated || '')}
                </div>
                <div className="text-xs text-gray-400">
                  Path: {file.path}
                </div>
                <button
                  onClick={async () => {
                    const res = await fetch('/api/write-to-github', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        filePath: file.path.replace(/^\//, ''),
                        fileContent: JSON.stringify(file.jsonData, null, 2),
                        commitMessage: `Add/update ${file.name} via LLM Discovery UI`
                      })
                    });
                    const result = await res.json();
                    if (result.success) {
                      alert('File written to GitHub!');
                    } else {
                      alert('Error writing file: ' + (result.error || 'Unknown error'));
                    }
                  }}
                  className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 ml-2"
                >
                  Write to Directory
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={async () => {
              for (const file of getEditableFilesFromDirectory(directoryStructure)) {
                await fetch('/api/write-to-github', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    filePath: file.path.replace(/^\//, ''),
                    fileContent: JSON.stringify(file.jsonData, null, 2),
                    commitMessage: `Add/update ${file.name} via LLM Discovery UI`
                  })
                });
              }
              alert('All files written to GitHub!');
            }}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 mt-4"
          >
            Add All Files to Directory
          </button>
        </div>

        {/* Edit File Modal */}
        {editingFile && (
          <EditFileModal file={editingFile} onClose={() => setEditingFile(null)} onSave={handleSaveFile} />
        )}
      </div>
    </div>
  );
} 