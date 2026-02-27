// components/UsageDashboard.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, Zap, AlertCircle, ArrowUp } from 'lucide-react';
// import MetricCard from './MetricCard'; // Optionnel, si vous voulez remplacer le HTML des jauges par des MetricCard

interface UsageData {
  transactionVolume: number;
  aiInsightsCount: number;
  planName: string;
  includedTransactionVolume: number;
  includedAiInsights: number;
  transactionVolumeRemaining: number;
  aiInsightsRemaining: number;
  isOverLimit: boolean;
}

interface BillingData {
  baseCharge: number;
  transactionVolumeOverageCharge: number;
  aiInsightsOverageCharge: number;
  totalAmount: number;
}

// ✅ NOUVEL UTILITAIRE : Standardisation du nom du plan pour l'affichage
function getPlanDisplayName(planName: string): string {
  const normalized = planName.toLowerCase();
  switch (normalized) {
    case 'starter':
      return 'Free';
    case 'professional':
    case 'pro': // Ajout d'un fallback si votre API renvoie 'pro'
      return 'Professional';
    case 'business':
      return 'Business';
    case 'enterprise':
      return 'Enterprise';
    default:
      return planName; // Retourne le nom original si inconnu
  }
}

export default function UsageDashboard() {
  const router = useRouter();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsageData();
  }, []);

  const fetchUsageData = async () => {
    try {
      // This would call your API endpoint
      const response = await fetch('/api/usage/current');
      const data = await response.json();
      setUsage(data.usage);
      setBilling(data.billing);
    } catch (error) {
      console.error('Error fetching usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePercentage = (used: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getStatusColor = (percentage: number) => {
    if (percentage >= 100) return 'text-red-500';
    if (percentage >= 80) return 'text-orange-500';
    if (percentage >= 50) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getProgressBarClasses = (percentage: number) => {
    const base =
      'w-full h-3 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-gray-200 [&::-moz-progress-bar]:bg-gray-200';

    if (percentage >= 100) {
      return `${base} [&::-webkit-progress-value]:bg-red-500 [&::-moz-progress-bar]:bg-red-500`;
    }

    if (percentage >= 80) {
      return `${base} [&::-webkit-progress-value]:bg-orange-500 [&::-moz-progress-bar]:bg-orange-500`;
    }

    if (percentage >= 50) {
      return `${base} [&::-webkit-progress-value]:bg-yellow-500 [&::-moz-progress-bar]:bg-yellow-500`;
    }

    return `${base} [&::-webkit-progress-value]:bg-green-500 [&::-moz-progress-bar]:bg-green-500`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatVolume = (amount: number) => {
    // La logique de formatage du volume peut rendre les nombres de l'API incompréhensibles si ce sont des centimes.
    // En supposant que `transactionVolume` est déjà en USD pour l'affichage:
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
    return formatCurrency(amount);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse bg-gray-200 h-48 rounded-lg"></div>
        <div className="animate-pulse bg-gray-200 h-48 rounded-lg"></div>
      </div>
    );
  }

  if (!usage || !billing) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <p className="text-yellow-800">Unable to load usage data. Please try again later.</p>
      </div>
    );
  }

  const volumePercentage = calculatePercentage(usage.transactionVolume, usage.includedTransactionVolume);
  const insightsPercentage = calculatePercentage(usage.aiInsightsCount, usage.includedAiInsights);
  const cappedVolumePercentage = Math.min(volumePercentage, 100);
  const cappedInsightsPercentage = Math.min(insightsPercentage, 100);

  return (
    <div className="space-y-6">
      
      {/* NOUVEAU HEADER POUR L'ACTION D'UPGRADE FACILE */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">
            Usage Overview
        </h1>
        <button
          onClick={() => router.push('/pricing')} // Permet l'upgrade ou le changement de plan à tout moment
          className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Upgrade / Change Plan
        </button>
      </div>
      {/* FIN NOUVEAU HEADER */}

      {/* Current Plan */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Current Plan</h2>
          <span className="px-4 py-2 bg-indigo-100 text-indigo-800 rounded-full font-semibold capitalize">
            {/* ✅ CORRECTION : Utilisation de getPlanDisplayName pour standardiser l'affichage */}
            {getPlanDisplayName(usage.planName)} 
          </span>
        </div>
        <p className="text-gray-600">
          Your current billing period ends on{' '}
          <strong>{new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString()}</strong>
        </p>
      </div>

      {/* Usage Meters */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Transaction Volume */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Transaction Volume</h3>
              <p className="text-sm text-gray-500">Monthly Stripe payments processed</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <span className={`text-3xl font-bold ${getStatusColor(volumePercentage)}`}>
                {formatVolume(usage.transactionVolume)}
              </span>
              <span className="text-gray-500">
                of {formatVolume(usage.includedTransactionVolume)}
              </span>
            </div>

            <progress
              value={cappedVolumePercentage}
              max={100}
              className={`${getProgressBarClasses(volumePercentage)} transition-all`}
              aria-label="Transaction volume usage"
            />

            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                {formatVolume(usage.transactionVolumeRemaining)} remaining
              </span>
              <span className={getStatusColor(volumePercentage)}>
                {volumePercentage.toFixed(0)}% used
              </span>
            </div>
          </div>

          {volumePercentage >= 80 && (
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-orange-800">
                You're approaching your limit. Consider upgrading to avoid overages.
              </p>
            </div>
          )}
        </div>

        {/* AI Insights */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <Zap className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">AI Insights</h3>
              <p className="text-sm text-gray-500">Revenue advisor queries this month</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <span className={`text-3xl font-bold ${getStatusColor(insightsPercentage)}`}>
                {usage.aiInsightsCount}
              </span>
              <span className="text-gray-500">of {usage.includedAiInsights}</span>
            </div>

            <progress
              value={cappedInsightsPercentage}
              max={100}
              className={`${getProgressBarClasses(insightsPercentage)} transition-all`}
              aria-label="AI insights usage"
            />

            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{usage.aiInsightsRemaining} remaining</span>
              <span className={getStatusColor(insightsPercentage)}>
                {insightsPercentage.toFixed(0)}% used
              </span>
            </div>
          </div>

          {insightsPercentage >= 80 && (
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-orange-800 mb-2">
                  Running low on AI insights. Upgrade for unlimited access.
                </p>
                <button
                  onClick={() => router.push('/pricing')} // ✅ CORRECTION : Ajout de l'action de navigation
                  className="inline-flex items-center gap-2 text-sm font-semibold text-orange-800 underline"
                >
                  <ArrowUp className="w-4 h-4" />
                  View plans
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Projected Bill */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg shadow-md p-6 border-2 border-indigo-200">
        <h2 className="text-2xl font-bold mb-4">Projected Bill</h2>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Base subscription</span>
            <span className="font-semibold">{formatCurrency(billing.baseCharge)}</span>
          </div>

          {billing.transactionVolumeOverageCharge > 0 && (
            <div className="flex justify-between items-center text-orange-600">
              <span>Transaction volume overage</span>
              <span className="font-semibold">
                +{formatCurrency(billing.transactionVolumeOverageCharge)}
              </span>
            </div>
          )}

          {billing.aiInsightsOverageCharge > 0 && (
            <div className="flex justify-between items-center text-orange-600">
              <span>AI insights overage</span>
              <span className="font-semibold">
                +{formatCurrency(billing.aiInsightsOverageCharge)}
              </span>
            </div>
          )}

          <div className="border-t-2 border-indigo-300 pt-3 flex justify-between items-center">
            <span className="text-xl font-bold">Total (estimated)</span>
            <span className="text-3xl font-bold text-indigo-600">
              {formatCurrency(billing.totalAmount)}
            </span>
          </div>
        </div>

        {(billing.transactionVolumeOverageCharge > 0 || billing.aiInsightsOverageCharge > 0) && (
          <div className="mt-4 p-4 bg-white rounded-lg border border-indigo-200">
            <p className="text-sm text-gray-700 mb-3">
              💡 You're currently paying for overages. Consider upgrading to save money:
            </p>
            <button 
              onClick={() => router.push('/pricing')} // ✅ CORRECTION : Ajout de l'action de navigation
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <ArrowUp className="w-4 h-4" />
              Upgrade Plan
            </button>
          </div>
        )}

        <p className="text-xs text-gray-500 mt-4">
          * Estimated based on current usage. Final bill calculated at end of billing period.
        </p>
      </div>
    </div>
  );
}