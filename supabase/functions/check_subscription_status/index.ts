import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id } = await req.json()

    if (!user_id) {
      throw new Error('Missing user_id parameter')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user's email from auth.users
    const { data: userData, error: userError } = await supabase
      .from('auth.users')
      .select('email')
      .eq('id', user_id)
      .single()

    if (userError || !userData) {
      throw new Error('User not found')
    }

    // Check for active subscription in invoices table
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_email', userData.email)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .limit(1)

    if (invoicesError) {
      throw new Error('Failed to check subscription status')
    }

    // Check if user has active subscription
    const hasActiveSubscription = invoices && invoices.length > 0

    // Get user's monthly schedule
    const { data: schedule, error: scheduleError } = await supabase
      .from('user_monthly_schedule')
      .select('*')
      .eq('user_id', user_id)
      .single()

    if (scheduleError && scheduleError.code !== 'PGRST116') {
      throw new Error('Failed to get monthly schedule')
    }

    // Determine subscription status
    let subscriptionStatus = 'inactive'
    let canContinueTesting = false
    let packageTier = null
    let nextTestDate = null

    if (hasActiveSubscription) {
      const latestInvoice = invoices[0]
      const billingPeriodEnd = new Date(latestInvoice.billing_period_end)
      const today = new Date()
      
      // Check if subscription is still active (within billing period)
      if (billingPeriodEnd > today) {
        subscriptionStatus = 'active'
        canContinueTesting = true
        packageTier = latestInvoice.package_tier
        nextTestDate = schedule?.next_test_date || new Date().toISOString().split('T')[0]
      } else {
        subscriptionStatus = 'expired'
        canContinueTesting = false
      }
    }

    // Update user's monthly schedule if needed
    if (schedule) {
      const { error: updateError } = await supabase
        .from('user_monthly_schedule')
        .update({
          subscription_status: subscriptionStatus,
          package_tier: packageTier || schedule.package_tier,
          next_test_date: nextTestDate || schedule.next_test_date,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user_id)

      if (updateError) {
        console.error('Failed to update monthly schedule:', updateError)
      }
    } else if (hasActiveSubscription) {
      // Create new schedule if user has subscription but no schedule
      const { error: insertError } = await supabase
        .from('user_monthly_schedule')
        .insert({
          user_id,
          package_tier: packageTier,
          subscription_status: subscriptionStatus,
          first_schedule_date: new Date().toISOString().split('T')[0],
          next_test_date: nextTestDate
        })

      if (insertError) {
        console.error('Failed to create monthly schedule:', insertError)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscription_status: subscriptionStatus,
        can_continue_testing: canContinueTesting,
        package_tier: packageTier,
        next_test_date: nextTestDate,
        has_active_subscription: hasActiveSubscription,
        latest_invoice: hasActiveSubscription ? invoices[0] : null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error checking subscription status:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        subscription_status: 'error',
        can_continue_testing: false
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}) 