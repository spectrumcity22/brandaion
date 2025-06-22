'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  phone?: string;
  company?: string;
  position?: string;
  bio?: string;
  created_at: string;
  last_sign_in?: string;
}

interface SubscriptionInfo {
  package_tier: string;
  status: string;
  billing_period_start: string;
  billing_period_end: string;
  faq_pairs_pm: number;
  faq_per_batch: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    company: '',
    position: '',
    bio: ''
  });

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);

      // Load profile data
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setFormData({
          full_name: profileData.full_name || '',
          phone: profileData.phone || '',
          company: profileData.company || '',
          position: profileData.position || '',
          bio: profileData.bio || ''
        });
      }

      // Load subscription info
      const { data: subscriptionData } = await supabase
        .from('invoices')
        .select('*')
        .eq('auth_user_id', user.id)
        .order('inserted_at', { ascending: false })
        .limit(1);

      if (subscriptionData?.[0]) {
        setSubscription(subscriptionData[0]);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading user data:', error);
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setMessage('Saving changes...');
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ...formData,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setMessage('✅ Profile updated successfully!');
      setIsEditing(false);
      loadUserData(); // Reload data
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
    }
  };

  const getSubscriptionStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'past_due': return 'text-yellow-400';
      case 'canceled': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getPackageIcon = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case 'premium': return '👑';
      case 'pro': return '💎';
      case 'starter': return '⭐';
      default: return '📦';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card p-8 text-center float-animation">
          <div className="w-16 h-16 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold shimmer-text">Loading Your Profile</h2>
          <p className="text-gray-400 mt-2">Preparing your premium experience...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="glass-card p-8 text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full premium-gradient flex items-center justify-center text-3xl font-bold text-white glow-animation">
            {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-3xl font-bold mb-2 shimmer-text">Your Profile</h1>
          <p className="text-gray-400">Manage your account and subscription details</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Profile Information */}
          <div className="glass-card p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Personal Information</h2>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="premium-button text-sm"
              >
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>

            {message && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${
                message.includes('❌') ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'
              }`}>
                {message}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="glass-input w-full p-3 text-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  disabled={!isEditing}
                  className="glass-input w-full p-3"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  disabled={!isEditing}
                  className="glass-input w-full p-3"
                  placeholder="Enter your phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Company</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({...formData, company: e.target.value})}
                  disabled={!isEditing}
                  className="glass-input w-full p-3"
                  placeholder="Enter your company name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Position</label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => setFormData({...formData, position: e.target.value})}
                  disabled={!isEditing}
                  className="glass-input w-full p-3"
                  placeholder="Enter your job title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({...formData, bio: e.target.value})}
                  disabled={!isEditing}
                  className="glass-input w-full p-3 h-24 resize-none"
                  placeholder="Tell us about yourself..."
                />
              </div>

              {isEditing && (
                <button
                  onClick={handleSave}
                  className="premium-button w-full"
                >
                  Save Changes
                </button>
              )}
            </div>
          </div>

          {/* Subscription Information */}
          <div className="space-y-6">
            <div className="glass-card p-8">
              <h2 className="text-2xl font-bold mb-6">Subscription Details</h2>
              
              {subscription ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getPackageIcon(subscription.package_tier)}</span>
                    <div>
                      <h3 className="text-lg font-semibold">{subscription.package_tier} Package</h3>
                      <p className={`text-sm ${getSubscriptionStatusColor(subscription.status)}`}>
                        Status: {subscription.status}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass-card p-4 text-center">
                      <div className="text-2xl font-bold text-brand">{subscription.faq_pairs_pm}</div>
                      <div className="text-sm text-gray-400">FAQ Pairs per Month</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                      <div className="text-2xl font-bold text-brand">{subscription.faq_per_batch}</div>
                      <div className="text-sm text-gray-400">FAQ Pairs per Batch</div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Billing Period:</span>
                      <span>{new Date(subscription.billing_period_start).toLocaleDateString()} - {new Date(subscription.billing_period_end).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Member Since:</span>
                      <span>{new Date(user?.created_at || '').toLocaleDateString()}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => router.push('/packages')}
                    className="premium-button w-full"
                  >
                    Manage Subscription
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">📦</div>
                  <h3 className="text-lg font-semibold mb-2">No Active Subscription</h3>
                  <p className="text-gray-400 mb-4">Get started with our premium FAQ generation service</p>
                  <button
                    onClick={() => router.push('/packages')}
                    className="premium-button"
                  >
                    View Packages
                  </button>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="glass-card p-8">
              <h2 className="text-2xl font-bold mb-6">Quick Actions</h2>
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="w-full p-3 glass-input hover:bg-white/10 transition-colors text-left"
                >
                  📊 Dashboard
                </button>
                <button
                  onClick={() => router.push('/schedule')}
                  className="w-full p-3 glass-input hover:bg-white/10 transition-colors text-left"
                >
                  📅 Schedule
                </button>
                <button
                  onClick={() => router.push('/faq-performance')}
                  className="w-full p-3 glass-input hover:bg-white/10 transition-colors text-left"
                >
                  📈 Performance Analytics
                </button>
                <button
                  onClick={() => router.push('/monthly-report')}
                  className="w-full p-3 glass-input hover:bg-white/10 transition-colors text-left"
                >
                  📋 Monthly Report
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Account Security */}
        <div className="glass-card p-8">
          <h2 className="text-2xl font-bold mb-6">Account Security</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Password</h3>
              <p className="text-gray-400 text-sm">Update your password to keep your account secure</p>
              <button className="premium-button">
                Change Password
              </button>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Two-Factor Authentication</h3>
              <p className="text-gray-400 text-sm">Add an extra layer of security to your account</p>
              <button className="premium-button">
                Enable 2FA
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 