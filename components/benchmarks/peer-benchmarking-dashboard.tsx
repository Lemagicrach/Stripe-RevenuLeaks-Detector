'use client'

import { useCallback, useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Users, Award, AlertCircle } from 'lucide-react'

// --- 1. TYPES DU COMPOSANT ---
interface BenchmarkComparison {
  metric: string
  userValue: number
  peerMedian: number
  peerP25: number
  peerP75: number
  peerP90?: number
  percentile: number
  status: 'excellent' | 'above_average' | 'average' | 'below_average' | 'needs_improvement'
  message: string
}

interface BenchmarkInsights {
  comparisons: BenchmarkComparison[]
  peerGroupSize: number
  industryVertical: string
  revenueTier: string
  summary: string
  currency: string
}

interface PeerBenchmarkingDashboardProps {
  connectionId: string
}

// --- 2. FONCTION UTILITAIRE : FORMATAGE DES VALEURS ---

function formatMetricValue(metric: string, value: number, currency: string = 'USD'): string {
    // Supposons que les métriques monétaires (MRR, ARPU, LTV) sont passées ici.
    if (metric.toLowerCase().includes('mrr') || metric.toLowerCase().includes('arpu') || metric.toLowerCase().includes('ltv')) {
        return value.toLocaleString('en-US', {
            style: 'currency',
            currency: currency,
            maximumFractionDigits: 0
        })
    }
    // Supposons que les métriques de taux (Churn, Growth) sont passées ici.
    if (metric.toLowerCase().includes('rate') || metric.toLowerCase().includes('churn') || metric.toLowerCase().includes('growth')) {
        return `${value.toFixed(2)}%`
    }
    // Pourcentiles ou autres nombres
    return value.toFixed(2)
}


export default function PeerBenchmarkingDashboard({ connectionId }: PeerBenchmarkingDashboardProps) {
  const [insights, setInsights] = useState<BenchmarkInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [optedIn, setOptedIn] = useState(false)
  const [showOptInModal, setShowOptInModal] = useState(false)

  // --- 3. LOGIQUE DE FETCH ---
  const fetchBenchmarks = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/benchmarks/compare?connectionId=${connectionId}`)
      const data = await response.json()

      if (data.success) {
        setInsights(data.insights)
        // Définit optedIn à true si le peerGroupSize est > 0
        setOptedIn(data.insights.peerGroupSize > 0) 
      }
    } catch (error) {
      console.error('Error fetching benchmarks:', error)
    } finally {
      setLoading(false)
    }
  }, [connectionId])

  useEffect(() => {
    fetchBenchmarks()
  }, [fetchBenchmarks])

  const handleOptIn = async (industryVertical: string, businessModel: string) => {
    try {
      const response = await fetch('/api/benchmarks/opt-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          industryVertical,
          businessModel,
          preferences: {
            shareMRR: true,
            shareChurn: true,
            shareARPU: true,
            shareGrowthRate: true,
            shareLTV: true,
          },
        }),
      })

      const data = await response.json()

      if (data.success) {
        setOptedIn(true)
        setShowOptInModal(false)
        // Re-fetch après l'opt-in pour charger les données
        fetchBenchmarks() 
      }
    } catch (error) {
      console.error('Error opting in:', error)
      alert('Failed to opt in to benchmarking')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'above_average':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'average':
        return 'text-gray-600 bg-gray-50 border-gray-200'
      case 'below_average':
        return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'needs_improvement':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent':
        return <Award className="w-5 h-5 text-green-600" />
      case 'above_average':
        return <TrendingUp className="w-5 h-5 text-blue-600" />
      case 'needs_improvement':
        return <TrendingDown className="w-5 h-5 text-red-600" />
      default:
        return null
    }
  }


  // --- RENDU : Chargement, Opt-in, et Succès ---
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!optedIn || !insights || insights.peerGroupSize === 0) {
    // NOTE: Affiché si l'utilisateur n'a pas encore rempli le modal Opt-In
    // ou si le backend n'a pas trouvé de groupe de pairs (peerGroupSize === 0).
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12">
        <div className="text-center max-w-2xl mx-auto">
          <Users className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Anonymous Peer Benchmarking
          </h2>
          <p className="text-gray-600 mb-6">
            Join our network to see how your metrics (MRR, Churn, ARPU, LTV) stack up against similar companies. Your data is anonymized and aggregated to protect your privacy.
          </p>
          <button
            onClick={() => setShowOptInModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Join Benchmarking Network
          </button>
        </div>

        {/* Opt-in Modal */}
        {showOptInModal && (
          <OptInModal
            onOptIn={handleOptIn}
            onClose={() => setShowOptInModal(false)}
          />
        )}
      </div>
    )
  }

  // Rendu de succès
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Peer Benchmarking</h2>
          <p className="text-gray-600 mt-1">
            Compare your metrics against {insights.peerGroupSize} similar businesses
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Your Segment</p>
          <p className="font-semibold text-gray-900">
            {insights.industryVertical.replace('_', ' ').toUpperCase()} • {insights.revenueTier.replace('_', ' ')}
          </p>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <AlertCircle className="w-6 h-6 text-blue-700" />
          <h3 className="text-lg font-semibold text-blue-900">Overall Insight</h3>
        </div>
        <p className="mt-2 text-blue-800">{insights.summary}</p>
      </div>

      {/* Metric Comparisons */}
      <div className="grid grid-cols-1 gap-6">
        {insights.comparisons.map((comparison, idx) => (
          <div key={idx} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">{comparison.metric}</h3>
              <div
                className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(comparison.status)} flex items-center space-x-1`}
              >
                {getStatusIcon(comparison.status)}
                <span>{comparison.status.replace('_', ' ').toUpperCase()}</span>
              </div>
            </div>
            <p className="text-gray-600 mt-2">{comparison.message}</p>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Your Value</p>
                <p className="text-lg font-bold text-blue-900">
                  {formatMetricValue(comparison.metric, comparison.userValue, insights.currency)} 
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Peer Median</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatMetricValue(comparison.metric, comparison.peerMedian, insights.currency)} 
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">25th Percentile</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatMetricValue(comparison.metric, comparison.peerP25, insights.currency)}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">75th Percentile</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatMetricValue(comparison.metric, comparison.peerP75, insights.currency)}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">Your Rank</p>
                <p className="text-lg font-bold text-gray-900">{comparison.percentile}th</p>
              </div>
            </div>

            {/* Visual percentile indicator */}
            <div className="mt-4">
              <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-blue-600 rounded-full"
                  style={{ width: `${comparison.percentile}%` }} // Style en ligne dynamique justifié
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Bottom</span>
                <span>Top</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info Footer */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-600">
          All benchmark data is anonymized, aggregated, and updated monthly.
        </p>
      </div>
    </div>
  )
}

// --- Composant Modal ---

// Interface formelle pour les props (Correction des erreurs TypeScript)
interface OptInModalProps {
  onOptIn: (industry: string, model: string) => Promise<void> | void
  onClose: () => void
}

function OptInModal({ onClose, onOptIn }: OptInModalProps) {
    const [industry, setIndustry] = useState('b2b_saas')
    const [model, setModel] = useState('subscription')

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Join Benchmarking Network</h3>

            <div className="space-y-4 mb-6">
            <div>
                <label htmlFor="industry-vertical" className="block text-sm font-medium text-gray-700 mb-2">
                Industry Vertical
                </label>
                <select
                id="industry-vertical" // CORRECTION A11Y
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                <option value="b2b_saas">B2B SaaS</option>
                <option value="b2c_saas">B2C SaaS</option>
                <option value="ecommerce">E-commerce</option>
                <option value="fintech">Fintech</option>
                <option value="healthcare">Healthcare</option>
                <option value="education">Education</option>
                </select>
            </div>

            <div>
                <label htmlFor="business-model" className="block text-sm font-medium text-gray-700 mb-2">
                Business Model
                </label>
                <select
                id="business-model" // CORRECTION A11Y
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                <option value="subscription">Subscription</option>
                <option value="usage_based">Usage-based</option>
                <option value="hybrid">Hybrid</option>
                <option value="freemium">Freemium</option>
                </select>
            </div>
            </div>

            <div className="flex gap-3">
            <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
                Cancel
            </button>
            <button
                onClick={() => onOptIn(industry, model)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
                Join Network
            </button>
            </div>
        </div>
        </div>
    )
}
