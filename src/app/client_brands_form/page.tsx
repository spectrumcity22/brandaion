"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Brand {
  id: string;
  auth_user_id: string;
  organisation_id: string;
  organisation_name: string;
  brand_name: string;
  brand_url: string;
  brand_jsonld_object: any;
  created_at?: string;
  updated_at?: string;
}

interface Organisation {
  id: string;
  organisation_name: string;
  auth_user_id: string;
}

export default function ClientBrandsForm() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [formData, setFormData] = useState<Partial<Brand>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!user || authError) {
        router.push('/login');
        return;
      }

      // Fetch all brands for this user
      const { data: brandsData, error: brandsError } = await supabase
        .from('brands')
        .select('*')
        .eq('auth_user_id', user.id)
        .order('created_at', { ascending: false });

      if (brandsError) {
        setError('Failed to load brands.');
      } else {
        setBrands(brandsData || []);
      }

      // Fetch organisations for this user
      const { data: orgsData, error: orgsError } = await supabase
        .from('client_organisation')
        .select('id, organisation_name, auth_user_id')
        .eq('auth_user_id', user.id);

      if (orgsError) {
        setError('Failed to load organisations.');
      } else {
        setOrganisations(orgsData || []);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data.');
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'organisation_id') {
      const selectedOrg = organisations.find(o => o.id === value);
      setFormData(prev => ({
        ...prev,
        organisation_id: value,
        organisation_name: selectedOrg ? selectedOrg.organisation_name : prev.organisation_name,
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated.');
        return;
      }

      let data, error;

      if (editingBrand) {
        // Update existing brand
        const { data: updateData, error: updateError } = await supabase
          .from('brands')
          .update({
            auth_user_id: user.id,
            organisation_id: formData.organisation_id,
            organisation_name: formData.organisation_name || '',
            brand_name: formData.brand_name || '',
            brand_url: formData.brand_url || ''
          })
          .eq('id', editingBrand.id)
          .select()
          .single();
        
        data = updateData;
        error = updateError;
      } else {
        // Insert new brand
        const { data: insertData, error: insertError } = await supabase
          .from('brands')
          .insert({
            auth_user_id: user.id,
            organisation_id: formData.organisation_id,
            organisation_name: formData.organisation_name || '',
            brand_name: formData.brand_name || '',
            brand_url: formData.brand_url || ''
          })
          .select()
          .single();
        
        data = insertData;
        error = insertError;
      }

      if (error) throw error;
      
      // Show success message
      setError(''); // Clear any previous errors
      setSuccess(true);
      
      // Refresh data
      await loadData();
      setShowForm(false);
      setEditingBrand(null);
      setFormData({});
      
      // Auto-redirect to products page after 3 seconds
      setTimeout(() => {
        router.push('/client_products');
      }, 3000);
    } catch (err) {
      console.error('Error saving brand:', err);
      setError('Error saving brand.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setFormData(brand);
    setShowForm(true);
  };

  const handleDelete = async (brandId: string) => {
    if (!confirm('Are you sure you want to delete this brand?')) return;
    
    try {
      const { error } = await supabase
        .from('brands')
        .delete()
        .eq('id', brandId);

      if (error) throw error;
      await loadData();
    } catch (err) {
      console.error('Error deleting brand:', err);
      setError('Error deleting brand.');
    }
  };

  const handleNewBrand = () => {
    setEditingBrand(null);
    setFormData({});
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingBrand(null);
    setFormData({});
    setError('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Brand Management</h1>
          <p className="text-gray-400">Manage your brands and their configurations</p>
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
            <p className="text-green-400">✅ Brand saved successfully! Redirecting to Products page...</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mb-6 flex justify-between items-center">
          <button
            onClick={handleNewBrand}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            + Add New Brand
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Brand Form */}
        {showForm && (
          <div className="mb-8 bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-white mb-6">
              {editingBrand ? 'Edit Brand' : 'Add New Brand'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-300 mb-2 font-medium">Organisation</label>
                  <select
                    name="organisation_id"
                    value={formData.organisation_id || ''}
                    onChange={handleChange}
                    className="w-full p-3 rounded-lg bg-gray-800/50 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    required
                  >
                    <option value="">Select an organisation</option>
                    {organisations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.organisation_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 mb-2 font-medium">Brand Name</label>
                  <input
                    type="text"
                    name="brand_name"
                    value={formData.brand_name || ''}
                    onChange={handleChange}
                    className="w-full p-3 rounded-lg bg-gray-800/50 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    placeholder="Enter brand name"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-gray-300 mb-2 font-medium">Brand URL</label>
                  <input
                    type="url"
                    name="brand_url"
                    value={formData.brand_url || ''}
                    onChange={handleChange}
                    className="w-full p-3 rounded-lg bg-gray-800/50 border border-gray-600/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    placeholder="https://yourbrand.com"
                  />
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  {saving ? 'Saving...' : (editingBrand ? 'Update Brand' : 'Create Brand')}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Brands List */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">Your Brands</h2>
          </div>
          
          {brands.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400 mb-4">No brands found. Create your first brand to get started.</p>
              <button
                onClick={handleNewBrand}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Create Your First Brand
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Brand Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Organisation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      URL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {brands.map((brand) => (
                    <tr key={brand.id} className="hover:bg-gray-700/30">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white">{brand.brand_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-300">{brand.organisation_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-300">
                          {brand.brand_url ? (
                            <a 
                              href={brand.brand_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300"
                            >
                              {brand.brand_url}
                            </a>
                          ) : (
                            <span className="text-gray-500">No URL</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-300">
                          {brand.created_at ? new Date(brand.created_at).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEdit(brand)}
                          className="text-blue-400 hover:text-blue-300 mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(brand.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 