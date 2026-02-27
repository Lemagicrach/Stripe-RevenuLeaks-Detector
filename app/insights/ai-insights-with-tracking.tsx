// app/insights/ai-insights-with-tracking.tsx
/**
 * Enhanced AI Insights Component with Usage Tracking
 * This handles usage metering display and blocks generation if limit is reached.
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { canGenerateAIInsight } from '@/lib/usage-tracking'; // Importe la vérification de limite

interface AIInsightsProps {
  userId: string;
  stripeConnectionId: string | null;
}

// Interface pour le résultat combiné de l'API
interface CombinedInsights {
    prediction: string;
    churn_risk: string;
    benchmarking: any; // Utiliser le type BenchmarkInsights si vous l'importez
    [key: string]: any;
}


export default function AIInsightsWithTracking({ userId, stripeConnectionId }: AIInsightsProps) {
  const router = useRouter();
  const [insights, setInsights] = useState<CombinedInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [usageWarning, setUsageWarning] = useState<string | null>(null);
  const [remainingInsights, setRemainingInsights] = useState<number | null>(null);

  // Fonction pour charger/rafraîchir l'état d'utilisation
  const refreshUsage = useCallback(async () => {
    if (!userId) return;
    
    const canGenerate = await canGenerateAIInsight(userId);
    setRemainingInsights(canGenerate.remaining);
    
    if (canGenerate.message) {
      setUsageWarning(canGenerate.message);
    } else {
      setUsageWarning(null);
    }
  }, [userId]);
  
  useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);


  const generateInsights = async () => {
    if (!stripeConnectionId) {
      setUsageWarning('Veuillez connecter votre compte Stripe pour générer des insights.');
      return;
    }
    
    try {
      setLoading(true);
      setUsageWarning(null);

      // Re-vérification de la limite avant l'appel API
      const canGenerate = await canGenerateAIInsight(userId);
      if (!canGenerate.allowed && canGenerate.remaining <= 0) {
        setUsageWarning(canGenerate.message || 'Limite atteinte');
        setLoading(false);
        return;
      }

      // Appel à la route API (qui gère l'appel à OpenAI et le suivi côté serveur)
      const response = await fetch(`/api/insights?connectionId=${stripeConnectionId}`, {
        method: 'GET', // Utilisation de GET si votre route est un GET
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Échec de la génération des insights');
      }

      const data = await response.json();
      setInsights(data);

      // ✅ Rafraîchir l'usage après la génération réussie.
      await refreshUsage(); 

    } catch (error) {
      console.error('Error generating insights:', error);
      setUsageWarning(error instanceof Error ? error.message : 'Échec de la génération des insights. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Usage Warning Banner */}
          {usageWarning && (
            <div className={`p-4 rounded-lg border ${
              remainingInsights !== null && remainingInsights <= 0 
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-orange-50 border-orange-200 text-orange-800'
            }`}>
              <p className="font-semibold mb-1">⚠️ Avis de Limite d'Utilisation</p>
              <p className="text-sm">{usageWarning}</p>
              {remainingInsights !== null && remainingInsights <= 0 && (
                <button
                  className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  onClick={() => router.push('/pricing')}
                >
                  Mettre à jour le Plan
                </button>
              )}
        </div>
      )}

      {/* Remaining Insights Counter */}
      {remainingInsights !== null && remainingInsights > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>{remainingInsights}</strong> insights IA restants ce mois-ci
          </p>
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={generateInsights}
        disabled={loading || (remainingInsights !== null && remainingInsights <= 0)}
        className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
          loading || (remainingInsights !== null && remainingInsights <= 0)
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
        }`}
      >
        {loading ? 'Génération en cours...' : 'Générer les Insights de Revenu IA'}
      </button>

      {/* Insights Display */}
      {insights && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold mb-4">Insights Générés par l'IA</h3>
          <div className="prose max-w-none">
                {insights.error && <p className="text-red-600 font-bold">{insights.error}</p>}
            <p><strong>Prédiction:</strong> {insights.prediction}</p>
            <p><strong>Analyse du Churn:</strong> {insights.churn_risk}</p>
            <p><strong>Score de Santé:</strong> {insights.health_score}</p>
            {/* Le benchmarking peut être rendu ici en utilisant insights.benchmarking */}
            <h4 className="mt-4 text-lg font-bold">Aperçu du Benchmarking</h4>
            <p className="text-sm">Groupe de Pairs: {insights.benchmarking?.peerGroupSize}</p>
            <p className="text-sm italic">{insights.benchmarking?.summary}</p>
          </div>
        </div>
      )}
    </div>
  );
}