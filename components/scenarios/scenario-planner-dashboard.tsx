'use client'

import { useCallback, useState, useEffect } from 'react'
import { TrendingUp, Calculator, Plus, Sparkles, DollarSign } from 'lucide-react'
import { Line } from 'react-chartjs-2'

interface MonthlyProjection {
  month: number
  mrr: number
  arr: number
  customers: number
}

interface ScenarioResult {
  scenarioId?: string
  name: string
  description: string
  scenarioType: string
  baseMRR: number
  baseCustomerCount: number
  projections: MonthlyProjection[]
  mrrImpact12m: number
  arrImpact12m: number
  customerImpact12m: number
  revenueImpactTotal: number
  insights: string[]
}

interface ScenarioPlannerDashboardProps {
  connectionId: string
}

export default function ScenarioPlannerDashboard({ connectionId }: ScenarioPlannerDashboardProps) {
  const [scenarios, setScenarios] = useState<ScenarioResult[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedScenario, setSelectedScenario] = useState<ScenarioResult | null>(null)

  const fetchScenarios = useCallback(async () => {
    try {
      const response = await fetch(`/api/scenarios/create?connectionId=${connectionId}`)
      const data = await response.json()

      if (data.success) {
        setScenarios(data.scenarios)
      }
    } catch (error) {
      console.error('Error fetching scenarios:', error)
    } finally {
      setLoading(false)
    }
  }, [connectionId])

  useEffect(() => {
    fetchScenarios()
  }, [fetchScenarios])

  const createScenario = async (
    name: string,
    scenarioType: string,
    parameters: any,
    description?: string
  ) => {
    setCreating(true)
    try {
      const response = await fetch('/api/scenarios/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          name,
          scenarioType,
          parameters,
          description,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setScenarios([data.scenario, ...scenarios])
        setShowCreateModal(false)
        setSelectedScenario(data.scenario)
      }
    } catch (error) {
      console.error('Error creating scenario:', error)
      alert('Failed to create scenario')
    } finally {
      setCreating(false)
    }
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
          <h2 className="text-2xl font-bold text-gray-900">Revenue Scenario Planner</h2>
          <p className="text-gray-600 mt-1">Model different growth strategies and see projected impact</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Scenario
        </button>
      </div>

      {/* Quick Templates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickTemplateCard
          title="Reduce Churn"
          description="See impact of lowering churn rate"
          icon={<TrendingUp className="w-6 h-6" />}
          color="green"
          onClick={() =>
            createScenario('Reduce Churn by 2%', 'churn_reduction', {
              churnRateReduction: 2,
              timeframeMonths: 12,
            })
          }
        />
        <QuickTemplateCard
          title="Increase Prices"
          description="Model price increase impact"
          icon={<DollarSign className="w-6 h-6" />}
          color="blue"
          onClick={() =>
            createScenario('20% Price Increase', 'price_increase', {
              priceIncreasePercent: 20,
              expectedChurnPercent: 5,
              timeframeMonths: 12,
            })
          }
        />
        <QuickTemplateCard
          title="Grow Faster"
          description="Add more customers per month"
          icon={<Sparkles className="w-6 h-6" />}
          color="purple"
          onClick={() =>
            createScenario('Add 10 Customers/Month', 'growth_acceleration', {
              newCustomersPerMonth: 10,
              timeframeMonths: 12,
            })
          }
        />
      </div>

      {/* Saved Scenarios */}
      {scenarios.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Your Scenarios</h3>
            <p className="text-sm text-gray-600 mt-1">Compare different growth strategies</p>
          </div>

          <div className="divide-y divide-gray-200">
            {scenarios.map((scenario) => (
              <div
                key={scenario.scenarioId}
                className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelectedScenario(scenario)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{scenario.name}</h4>
                    {scenario.description && (
                      <p className="text-sm text-gray-600 mt-1">{scenario.description}</p>
                    )}

                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-gray-500">MRR Impact (12m)</p>
                        <p className="text-lg font-semibold text-green-600">
                          +${Math.round(scenario.mrrImpact12m).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">ARR Impact (12m)</p>
                        <p className="text-lg font-semibold text-green-600">
                          +${Math.round(scenario.arrImpact12m).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Customer Impact</p>
                        <p className="text-lg font-semibold text-blue-600">
                          +{scenario.customerImpact12m}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedScenario(scenario)
                    }}
                    className="ml-4 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {scenarios.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Calculator className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No scenarios yet</h3>
          <p className="text-gray-600 mb-6">
            Create your first scenario to model different growth strategies
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Create First Scenario
          </button>
        </div>
      )}

      {/* Scenario Detail Modal */}
      {selectedScenario && (
        <ScenarioDetailModal
          scenario={selectedScenario}
          onClose={() => setSelectedScenario(null)}
        />
      )}

      {/* Create Scenario Modal */}
      {showCreateModal && (
        <CreateScenarioModal
          onClose={() => setShowCreateModal(false)}
          onCreate={createScenario}
          creating={creating}
        />
      )}
    </div>
  )
}

function QuickTemplateCard({
  title,
  description,
  icon,
  color,
  onClick,
}: {
  title: string
  description: string
  icon: React.ReactNode
  color: string
  onClick: () => void
}) {
  const colorClasses = {
    green: 'bg-green-50 text-green-600 hover:bg-green-100',
    blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    purple: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
  }

  return (
    <button
      onClick={onClick}
      className={`p-6 rounded-lg border border-gray-200 text-left transition-colors ${
        colorClasses[color as keyof typeof colorClasses]
      }`}
    >
      <div className="mb-3">{icon}</div>
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </button>
  )
}

function ScenarioDetailModal({
  scenario,
  onClose,
}: {
  scenario: ScenarioResult
  onClose: () => void
}) {
  const chartData = {
    labels: scenario.projections.map((p) => `Month ${p.month}`),
    datasets: [
      {
        label: 'Projected MRR',
        data: scenario.projections.map((p) => p.mrr),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Baseline MRR',
        data: scenario.projections.map(() => scenario.baseMRR),
        borderColor: 'rgb(156, 163, 175)',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0,
      },
    ],
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{scenario.name}</h3>
            {scenario.description && (
              <p className="text-sm text-gray-600 mt-1">{scenario.description}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Impact Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">MRR Impact (12m)</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                +${Math.round(scenario.mrrImpact12m).toLocaleString()}
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Total Revenue (12m)</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                ${Math.round(scenario.revenueImpactTotal).toLocaleString()}
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600">Customer Impact</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                +{scenario.customerImpact12m}
              </p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-4">MRR Projection</h4>
            <Line
              data={chartData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: 'top' as const,
                  },
                },
                scales: {
                  y: {
                    beginAtZero: false,
                    ticks: {
                      callback: (value) => `$${value.toLocaleString()}`,
                    },
                  },
                },
              }}
            />
          </div>

          {/* Insights */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Key Insights</h4>
            <div className="space-y-2">
              {scenario.insights.map((insight, idx) => (
                <div key={idx} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">{insight}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CreateScenarioModal({
  onClose,
  onCreate,
  creating,
}: {
  onClose: () => void
  onCreate: (name: string, type: string, params: any, description?: string) => void
  creating: boolean
}) {
  const [name, setName] = useState('')
  const [scenarioType, setScenarioType] = useState('churn_reduction')
  const [params, setParams] = useState<any>({
    churnRateReduction: 2,
    timeframeMonths: 12,
  })

  const handleCreate = () => {
    if (!name.trim()) {
      alert('Please enter a scenario name')
      return
    }
    onCreate(name, scenarioType, params)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Create New Scenario</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Scenario Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Reduce Churn by 2%"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Scenario Type</label>
            <select
              value={scenarioType}
              onChange={(e) => {
                setScenarioType(e.target.value)
                // Reset params based on type
                if (e.target.value === 'churn_reduction') {
                  setParams({ churnRateReduction: 2, timeframeMonths: 12 })
                } else if (e.target.value === 'price_increase') {
                  setParams({
                    priceIncreasePercent: 20,
                    expectedChurnPercent: 5,
                    timeframeMonths: 12,
                  })
                } else if (e.target.value === 'growth_acceleration') {
                  setParams({ newCustomersPerMonth: 10, timeframeMonths: 12 })
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="churn_reduction">Reduce Churn Rate</option>
              <option value="price_increase">Increase Prices</option>
              <option value="growth_acceleration">Accelerate Growth</option>
              <option value="upsell">Upsell Customers</option>
            </select>
          </div>

          {/* Dynamic parameters based on scenario type */}
          {scenarioType === 'churn_reduction' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Churn Reduction (%)
              </label>
              <input
                type="number"
                value={params.churnRateReduction}
                onChange={(e) =>
                  setParams({ ...params, churnRateReduction: parseFloat(e.target.value) })
                }
                step="0.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {scenarioType === 'price_increase' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price Increase (%)
                </label>
                <input
                  type="number"
                  value={params.priceIncreasePercent}
                  onChange={(e) =>
                    setParams({ ...params, priceIncreasePercent: parseFloat(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expected Customer Loss (%)
                </label>
                <input
                  type="number"
                  value={params.expectedChurnPercent}
                  onChange={(e) =>
                    setParams({ ...params, expectedChurnPercent: parseFloat(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {scenarioType === 'growth_acceleration' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Customers per Month
              </label>
              <input
                type="number"
                value={params.newCustomersPerMonth}
                onChange={(e) =>
                  setParams({ ...params, newCustomersPerMonth: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Timeframe (months)
            </label>
            <select
              value={params.timeframeMonths}
              onChange={(e) => setParams({ ...params, timeframeMonths: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="3">3 months</option>
              <option value="6">6 months</option>
              <option value="12">12 months</option>
              <option value="24">24 months</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={creating}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Scenario'}
          </button>
        </div>
      </div>
    </div>
  )
}
