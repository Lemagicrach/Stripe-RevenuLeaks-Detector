'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Loader2,
  TrendingUp,
  AlertCircle,
  Users,
  Tag,
  Heart,
  Sparkles,
} from 'lucide-react'

interface InsightsData {
  prediction: string
  churn_risk: string
  growth: string
  pricing: string
  health_score: string
}

/**
 * AI Insights Page
 *
 * This page displays AI‑generated insights about the user's revenue,
 * churn risk, growth opportunities, pricing suggestions and overall health.
 * It follows the same card‑based layout and dark‑mode styling as the dashboard.
 */
export default function InsightsPage() {
  const [insights, setInsights] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInsights = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/insights')
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch insights')
      }
      setInsights(data as InsightsData)
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to load insights')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInsights()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 dark:text-indigo-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Generating AI insights...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 text-lg">{error}</p>
          <button
            onClick={fetchInsights}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!insights) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400 text-lg">No insights available</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
            AI Insights
          </h1>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            ← Back to dashboard
          </Link>
        </div>
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
              Revenue Prediction
            </h2>
            <p className="text-gray-700 dark:text-gray-300">{insights.prediction}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
              Churn Risk Analysis
            </h2>
            <p className="text-gray-700 dark:text-gray-300">{insights.churn_risk}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
              <Users className="w-5 h-5 text-green-500 dark:text-green-400" />
              Growth Opportunities
            </h2>
            <p className="text-gray-700 dark:text-gray-300">{insights.growth}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
              <Tag className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
              Pricing Suggestion
            </h2>
            <p className="text-gray-700 dark:text-gray-300">{insights.pricing}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
              <Heart className="w-5 h-5 text-purple-500 dark:text-purple-400" />
              Overall Health Score
            </h2>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{insights.health_score}</p>
          </div>
        </div>
      </div>
    </div>
  )
}