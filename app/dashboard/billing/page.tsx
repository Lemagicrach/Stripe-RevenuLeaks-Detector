'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import SubscriptionInfo from '@/components/SubscriptionInfo'
import type {
  SubscriptionTier as Tier,
  SubscriptionStatus as Status,
} from '@/lib/subscription-types'

interface ProfileRow {
  subscription_tier: string | null
  subscription_status: string | null
  subscription_current_period_end: string | null
}

export default function BillingPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) throw sessionError

        if (!session) {
          router.push('/login?redirect=/dashboard/billing')
          return
        }

        const { data, error: profileError } = await supabase
          .from('user_profiles')
          .select(
            'subscription_tier, subscription_status, subscription_current_period_end'
          )
          .eq('user_id', session.user.id)
          .maybeSingle()

        if (profileError || !data) {
          console.error('Billing profile error:', profileError)
          setError('Unable to load subscription information.')
          return
        }

        setProfile({
          subscription_tier: data.subscription_tier,
          subscription_status: data.subscription_status,
          subscription_current_period_end: data.subscription_current_period_end,
        })
      } catch (err) {
        console.error('Billing page error:', err)
        setError('Something went wrong while loading billing information.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" />
          <p className="text-gray-600">Loading your billing details...</p>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Billing Information Unavailable
          </h1>
          <p className="text-gray-600 mb-6">
            {error || 'We could not load your current plan. Please try again.'}
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const tier = (profile.subscription_tier || 'starter') as Tier
  const status = (profile.subscription_status || 'active') as Status
  const periodEnd = profile.subscription_current_period_end

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Billing & Plan</h1>
          <p className="text-gray-600 mt-2">
            View your current plan, billing status, and manage your subscription.
          </p>
        </div>

        <SubscriptionInfo tier={tier} status={status} periodEnd={periodEnd} />
      </div>
    </div>
  )
}
