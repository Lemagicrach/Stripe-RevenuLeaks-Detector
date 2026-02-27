'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, TrendingDown, Mail, CheckCircle, Clock } from 'lucide-react'

interface ChurnPrediction {
  id: string
  customer_id: string
  subscription_id: string
  risk_score: number
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  churn_probability: number
  predicted_churn_date: string | null
  mrr_at_risk: number
  ltv_at_risk: number
  risk_factors: Array<{
    factor: string
    weight: number
    description: string
  }>
  recommended_actions: Array<{
    action: string
    priority: number
    description: string
  }>
  generated_email_subject: string
  generated_email_body: string
  email_tone: string
  status: string
  created_at: string
}
type UserTier = 'starter' | 'professional' | 'business' | 'enterprise';

interface ChurnPreventionDashboardProps {
  connectionId: string
  userTier: UserTier;
}

export default function ChurnPreventionDashboard({ connectionId, userTier }: ChurnPreventionDashboardProps) {
  const [predictions, setPredictions] = useState<ChurnPrediction[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [selectedPrediction, setSelectedPrediction] = useState<ChurnPrediction | null>(null)
  const [summary, setSummary] = useState({
    total: 0,
    high_risk: 0,
    total_mrr_at_risk: 0,
  })

  const fetchPredictions = useCallback(async () => {
    try {
      const response = await fetch(`/api/churn/analyze?connectionId=${connectionId}`)
      const data = await response.json()

      if (data.success) {
        setPredictions(data.predictions)
        setSummary(data.summary)
      }
    } catch (error) {
      console.error('Error fetching predictions:', error)
    } finally {
      setLoading(false)
    }
  }, [connectionId])

  useEffect(() => {
    fetchPredictions()
  }, [fetchPredictions])

  const runAnalysis = async () => {
    setAnalyzing(true)
    try {
      const response = await fetch('/api/churn/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      })

      const data = await response.json()

      if (data.success) {
        setPredictions(data.predictions)
        setSummary(data.summary)
      }
    } catch (error) {
      console.error('Error running analysis:', error)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleIntervention = async (predictionId: string, sendEmail: boolean) => {
    try {
      const response = await fetch('/api/churn/intervene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          predictionId,
          interventionType: 'email',
          sendEmail,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Refresh predictions
        fetchPredictions()
        alert(sendEmail ? 'Email sent successfully!' : 'Intervention recorded')
      }
    } catch (error) {
      console.error('Error recording intervention:', error)
      alert('Failed to record intervention')
    }
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'high':
        return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      default:
        return 'text-green-600 bg-green-50 border-green-200'
    }
  }

  const getRiskBadge = (level: string) => {
    const colors = getRiskColor(level)
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${colors}`}>
        {level.toUpperCase()}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Churn Prevention Assistant</h2>
          <p className="text-gray-600 mt-1">AI-powered churn risk analysis and intervention</p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={analyzing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {analyzing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Analyzing...
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4" />
              Run Analysis
            </>
          )}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">At-Risk Customers</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{summary.high_risk}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">MRR at Risk</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                ${summary.total_mrr_at_risk.toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Analyzed</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{summary.total}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Predictions List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">At-Risk Customers</h3>
          <p className="text-sm text-gray-600 mt-1">
            Customers with medium to critical churn risk
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {predictions.length === 0 ? (
            <div className="p-12 text-center">
              <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No at-risk customers found</p>
              <p className="text-sm text-gray-500 mt-1">Run an analysis to check for churn risk</p>
            </div>
          ) : (
            predictions.map((prediction) => (
              <div
                key={prediction.id}
                className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelectedPrediction(prediction)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getRiskBadge(prediction.risk_level)}
                      <span className="text-sm text-gray-600">
                        Customer: {prediction.customer_id.slice(0, 20)}...
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                      <div>
                        <p className="text-xs text-gray-500">Risk Score</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {prediction.risk_score}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Churn Probability</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {prediction.churn_probability}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">MRR at Risk</p>
                        <p className="text-lg font-semibold text-gray-900">
                          ${prediction.mrr_at_risk.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Status</p>
                        <p className="text-lg font-semibold text-gray-900 capitalize">
                          {prediction.status}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-1">Top Risk Factors:</p>
                      <div className="flex flex-wrap gap-2">
                        {prediction.risk_factors.slice(0, 3).map((factor, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                          >
                            {factor.description}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedPrediction(prediction)
                      }}
                      className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Prediction Detail Modal */}
      {selectedPrediction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Churn Risk Details</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Customer: {selectedPrediction.customer_id}
                </p>
              </div>
              <button
                onClick={() => setSelectedPrediction(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Risk Overview */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Risk Overview</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Risk Level</p>
                    <div className="mt-2">{getRiskBadge(selectedPrediction.risk_level)}</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Risk Score</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {selectedPrediction.risk_score}%
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Churn Probability</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {selectedPrediction.churn_probability}%
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">MRR at Risk</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      ${selectedPrediction.mrr_at_risk.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Risk Factors */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Risk Factors</h4>
                <div className="space-y-2">
                  {selectedPrediction.risk_factors.map((factor, idx) => (
                    <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-red-900">{factor.description}</p>
                        <span className="text-xs text-red-600">
                          Weight: {(factor.weight * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended Actions */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Recommended Actions</h4>
                <div className="space-y-2">
                  {selectedPrediction.recommended_actions.map((action, idx) => (
                    <div key={idx} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-900">
                            {action.description}
                          </p>
                          <p className="text-xs text-blue-600 mt-1">
                            Priority: {action.priority}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Generated Email */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">AI-Generated Email</h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 p-3 border-b border-gray-200">
                    <p className="text-sm text-gray-600">Subject:</p>
                    <p className="font-medium text-gray-900">
                      {selectedPrediction.generated_email_subject}
                    </p>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedPrediction.generated_email_body}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleIntervention(selectedPrediction.id, false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Mark as Reviewed
                </button>
                <button
                  onClick={() => {
                    if (confirm('Send this email to the customer?')) {
                      handleIntervention(selectedPrediction.id, true)
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Send Email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
