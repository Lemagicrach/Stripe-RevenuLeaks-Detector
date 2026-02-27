// app/dashboard/benchmarks/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PeerBenchmarkingDashboard from '@/components/benchmarks/peer-benchmarking-dashboard'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function BenchmarksPage() {
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
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading peer benchmarking dashboard...</p>
        </div>
      </div>
    )
  }

  // Feature gating - Starter tier users see upgrade prompt
  if (userTier === 'starter') {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h1 className="text-3xl font-bold mb-4">Upgrade to Access Peer Benchmarking</h1>
            <p className="text-gray-600 mb-6 text-lg">
              Compare your metrics against similar businesses with Pro or Business plans.
            </p>
            
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">What You'll Get:</h2>
              <ul className="text-left space-y-3 max-w-md mx-auto">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Anonymous comparison with similar businesses</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Percentile rankings across key metrics</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Industry-specific benchmarks</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Actionable insights to improve performance</span>
                </li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 mb-8">
              <h3 className="font-semibold mb-3">Example Insights:</h3>
              <div className="space-y-2 text-sm text-left max-w-md mx-auto">
                <div className="flex items-center justify-between bg-white p-3 rounded">
                  <span>Your MRR Growth</span>
                  <span className="font-semibold text-blue-600">65th percentile</span>
                </div>
                <div className="flex items-center justify-between bg-white p-3 rounded">
                  <span>Your Churn Rate</span>
                  <span className="font-semibold text-green-600">Top 25%</span>
                </div>
                <div className="flex items-center justify-between bg-white p-3 rounded">
                  <span>Your ARPU</span>
                  <span className="font-semibold text-orange-600">40th percentile</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => router.push('/pricing')}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                View Pricing
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Back to Dashboard
              </button>
            </div>

            <p className="text-sm text-gray-500 mt-6">
              Pro plan starts at $29/month • Cancel anytime
            </p>
          </div>
        </div>
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
              To use peer benchmarking features, you need to connect your Stripe account first.
            </p>
            <div className="flex gap-4 justify-center">
              <a
                href="/api/stripe/connect"
                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
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
              We couldn't load your peer benchmarking dashboard. Please try again.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
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

  // Success - render the dashboard
  if (!connectionId) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PeerBenchmarkingDashboard connectionId={connectionId} />
    </div>
  )
}
