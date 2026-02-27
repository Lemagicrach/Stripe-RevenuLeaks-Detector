// app/dashboard/scenarios/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ScenarioPlannerDashboard from '@/components/scenarios/scenario-planner-dashboard'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { buildConnectUrl } from '@/lib/plan-flow'

export default function ScenariosPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userTier, setUserTier] = useState<'starter' | 'pro' | 'business'>('starter')

  useEffect(() => {
    async function loadConnection() {
      try {
        // Get current user
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) throw sessionError
        
        if (!session) {
          router.push('/login')
          return
        }

        // Get user's subscription tier
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('subscription_tier')
          .eq('user_id', session.user.id)
          .single()

        if (profile?.subscription_tier) {
          setUserTier(profile.subscription_tier)
        }

        // Get user's active Stripe connection
        const { data: connections, error: connectionsError } = await supabase
          .from('stripe_connections')
          .select('id, account_id, is_active')
          .eq('user_id', session.user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)

        if (connectionsError) throw connectionsError

        if (!connections || connections.length === 0) {
          setError('no_connection')
          setLoading(false)
          return
        }

        setConnectionId(connections[0].id)
        setLoading(false)

      } catch (err) {
        console.error('Error loading connection:', err)
        setError('load_error')
        setLoading(false)
      }
    }

    loadConnection()
  }, [router, supabase])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
          <p className="text-gray-600">Loading revenue scenario planner...</p>
        </div>
      </div>
    )
  }

  // Feature gating - Starter and Pro tier users see upgrade prompt for full access
  // Pro users get limited access (3 scenarios), Business gets unlimited
  if (userTier === 'starter') {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">🎯</div>
            <h1 className="text-3xl font-bold mb-4">Upgrade to Access Revenue Scenarios</h1>
            <p className="text-gray-600 mb-6 text-lg">
              Model different growth strategies and see projected impact with Pro or Business plans.
            </p>
            
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">What You'll Get:</h2>
              <ul className="text-left space-y-3 max-w-md mx-auto">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Model churn reduction, price increases, and growth strategies</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Month-by-month MRR and ARR projections</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Visual charts showing projected vs. baseline</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>AI-generated insights comparing scenarios</span>
                </li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 mb-8">
              <h3 className="font-semibold mb-3">Example Scenario:</h3>
              <div className="space-y-3 text-left max-w-md mx-auto">
                <div className="bg-white p-4 rounded-lg border-2 border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">Reduce Churn by 2%</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Recommended</span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex justify-between">
                      <span>12-Month MRR Impact:</span>
                      <span className="font-semibold text-green-600">+$5,000</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Revenue Impact:</span>
                      <span className="font-semibold text-green-600">+$30,000</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Customer Impact:</span>
                      <span className="font-semibold">+10 customers</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-500 italic">
                  "Reducing churn by 2% would have the same impact as acquiring 20 new customers"
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8 max-w-2xl mx-auto">
              <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Pro Plan</h4>
                <p className="text-2xl font-bold text-blue-600 mb-2">$29/mo</p>
                <p className="text-sm text-gray-600 mb-3">3 scenarios included</p>
                <button
                  onClick={() => router.push(buildConnectUrl('professional'))}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  Choose Pro
                </button>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-300 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Business Plan</h4>
                <p className="text-2xl font-bold text-green-600 mb-2">$79/mo</p>
                <p className="text-sm text-gray-600 mb-3">Unlimited scenarios</p>
                <button
                  onClick={() => router.push(buildConnectUrl('business'))}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
                >
                  Choose Business
                </button>
              </div>
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Pro tier users see limited access notice
  if (userTier === 'pro') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-blue-500 to-green-500 text-white p-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <p className="font-semibold">Pro Plan: 3 Scenarios Included</p>
              <p className="text-sm opacity-90">Upgrade to Business for unlimited scenarios</p>
            </div>
            <button
              onClick={() => router.push(buildConnectUrl('business'))}
              className="px-6 py-2 bg-white text-green-600 rounded-lg font-semibold hover:bg-gray-100 transition"
            >
              Upgrade to Business
            </button>
          </div>
        </div>
        {connectionId && <ScenarioPlannerDashboard connectionId={connectionId} />}
      </div>
    )
  }

  // No connection error
  if (error === 'no_connection') {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">🔌</div>
            <h1 className="text-2xl font-bold mb-4">Connect Your Stripe Account</h1>
            <p className="text-gray-600 mb-6">
              To use revenue scenario planning features, you need to connect your Stripe account first.
            </p>
            <div className="flex gap-4 justify-center">
              <a
                href={buildConnectUrl()}
                className="px-8 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
              >
                Connect Stripe
              </a>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Load error
  if (error === 'load_error') {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold mb-4">Something Went Wrong</h1>
            <p className="text-gray-600 mb-6">
              We couldn't load your revenue scenario planner. Please try again.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-8 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
              >
                Retry
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Success - render the dashboard (Business tier gets full access)
  if (!connectionId) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ScenarioPlannerDashboard connectionId={connectionId} />
    </div>
  )
}
