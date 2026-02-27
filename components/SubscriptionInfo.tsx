'use client'

import { useRouter } from 'next/navigation'
import type {
  SubscriptionStatus as Status,
  SubscriptionTier as Tier,
} from '@/lib/subscription-types'

interface SubscriptionInfoProps {
  tier: Tier
  status: Status
  periodEnd: string | null
}

export default function SubscriptionInfo({ tier, status, periodEnd }: SubscriptionInfoProps) {
  const router = useRouter()

  const getTierDisplay = () => {
    const normalizedTier = tier === 'pro' ? 'professional' : tier
    switch (normalizedTier) {
      case 'starter':
        return 'Free'
      case 'professional':
        return 'Professional'
      case 'business':
        return 'Business'
      case 'enterprise':
        return 'Enterprise'
      default:
        return 'Free'
    }
  }

  const getStatusBadge = () => {
    const normalized = status === 'canceled' ? 'cancelled' : status
    switch (normalized) {
      case 'active':
        return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Active</span>
      case 'trialing':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">Trialing</span>
      case 'past_due':
        return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">Past Due</span>
      case 'cancelled':
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">Cancelled</span>
      case 'paused':
        return <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">Paused</span>
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">Inactive</span>
    }
  }

  const handleManageBilling = async () => {
    try {
      const response = await fetch('/api/create-portal', { method: 'POST' })
      const data = await response.json()
      if (data.url) window.location.href = data.url
    } catch (error) {
      console.error('Portal error:', error)
      alert('Failed to open billing portal')
    }
  }

  const isCancelled = status === 'cancelled' || status === 'canceled'

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Subscription</h3>
          <p className="text-sm text-gray-600">Manage your billing and plan</p>
        </div>
        {getStatusBadge()}
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center py-2 border-t">
          <span className="text-gray-600">Current Plan</span>
          <span className="font-medium">{getTierDisplay()}</span>
        </div>

        {periodEnd && (
          <div className="flex justify-between items-center py-2 border-t">
            <span className="text-gray-600">
              {isCancelled ? 'Access Until' : 'Next Billing Date'}
            </span>
            <span className="font-medium">
              {new Date(periodEnd).toLocaleDateString()}
            </span>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          {tier === 'starter' ? (
            <button
              onClick={() => router.push('/pricing')}
              className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Upgrade Plan
            </button>
          ) : (
            <>
              <button
                onClick={() => router.push('/pricing')}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Change Plan
              </button>
              <button
                onClick={handleManageBilling}
                className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors"
              >
                Manage Billing
              </button>
            </>
          )}
        </div>
      </div>

      {status === 'past_due' && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">
            ⚠️ Your payment failed. Please update your payment method to avoid service interruption.
          </p>
        </div>
      )}
    </div>
  )
}
