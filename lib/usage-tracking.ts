// /lib/usage-tracking.ts
/**
 * Usage Tracking Service
 * Handles metering for usage-based pricing using Supabase RPCs.
 */

import { getSupabaseServerClient } from '@/lib/supabase/server'; // Assurez-vous que cette importation est correcte

export interface UsageMetrics {
  transactionVolume: number;
  aiInsightsCount: number;
  planName: string;
  includedTransactionVolume: number;
  includedAiInsights: number;
  transactionVolumeRemaining: number;
  aiInsightsRemaining: number;
  isOverLimit: boolean;
}

export interface BillingCalculation {
  baseCharge: number;
  transactionVolumeOverageCharge: number;
  aiInsightsOverageCharge: number;
  totalAmount: number;
}

/**
 * Track an AI insight generation event using a Supabase RPC.
 * This is called by the server API route after a successful OpenAI call.
 */
export async function trackAIInsight(
  userId: string,
  stripeConnectionId: string | null,
  metadata: Record<string, any> = {}
): Promise<boolean> {
  try {
    const supabase = await getSupabaseServerClient(); // Utilise le client serveur pour les RPC
    
    if (!stripeConnectionId) {
        console.error('trackAIInsight called without stripeConnectionId');
        return false;
    }

    const { error } = await supabase.rpc('track_ai_insight_usage', {
      p_user_id: userId,
      p_stripe_connection_id: stripeConnectionId,
      p_metadata: metadata,
    });

    if (error) {
      console.error('Error tracking AI insight:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception tracking AI insight:', error);
    return false;
  }
}

/**
 * Get current month usage for a user using a Supabase RPC.
 * This is used to determine remaining limits.
 */
export async function getCurrentMonthUsage(userId: string): Promise<UsageMetrics | null> {
  try {
    const supabase = await getSupabaseServerClient();
    
    const { data, error } = await supabase.rpc('get_current_month_usage', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Error getting current month usage:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const usage = data[0];
    return {
      transactionVolume: parseFloat(usage.transaction_volume) || 0,
      aiInsightsCount: parseInt(usage.ai_insights_count) || 0,
      planName: usage.plan_name || 'free',
      includedTransactionVolume: parseFloat(usage.included_transaction_volume) || 0,
      includedAiInsights: parseInt(usage.included_ai_insights) || 0,
      transactionVolumeRemaining: parseFloat(usage.transaction_volume_remaining) || 0,
      aiInsightsRemaining: parseInt(usage.ai_insights_remaining) || 0,
      isOverLimit: usage.is_over_limit || false,
    };
  } catch (error) {
    console.error('Exception getting current month usage:', error);
    return null;
  }
}

/**
 * Check if user can generate AI insight (within limit).
 * Utilizes getCurrentMonthUsage RPC result.
 */
export async function canGenerateAIInsight(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  message?: string;
}> {
  const usage = await getCurrentMonthUsage(userId);
  
  if (!usage) {
    return {
      allowed: false,
      remaining: 0,
      message: 'Unable to check usage limits. Please try again.',
    };
  }

  const remaining = usage.aiInsightsRemaining;
  
  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      message: `Vous avez atteint votre limite mensuelle de ${usage.includedAiInsights} insights IA. Veuillez mettre à jour votre plan pour continuer.`,
    };
  }

  // Avertissement à 80% d'utilisation
  if (remaining <= usage.includedAiInsights * 0.2 && remaining > 0) {
    return {
      allowed: true,
      remaining,
      message: `Il ne vous reste que ${remaining} insights IA ce mois-ci. Envisagez de passer à un plan supérieur.`,
    };
  }

  return {
    allowed: true,
    remaining,
    message: `Plan actuel: ${usage.planName}. Limite mensuelle : ${usage.includedAiInsights} insights.`,
  };
}

// ... (Les autres fonctions d'assistance de votre fichier original sont omises ici pour la concision) ...