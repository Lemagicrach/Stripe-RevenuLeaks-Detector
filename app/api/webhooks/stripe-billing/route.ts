// /api/webhooks/stripe-billing/route.ts

import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/server-error'
import { getSupabaseAdminClient } from '@/lib/server-clients'

// Fonction utilitaire pour déterminer les limites d'utilisation
const getUsageLimits = (tier: string) => {
  switch (tier) {
    case 'starter':
      return {
        scenarioLimit: 5,
        aiInsightsLimit: 10,
        transactionVolumeLimit: 10000,
      }
    case 'professional':
      return {
        scenarioLimit: 50,
        aiInsightsLimit: 500,
        transactionVolumeLimit: 500000,
      }
    case 'business':
      return {
        scenarioLimit: 200,
        aiInsightsLimit: 2000,
        transactionVolumeLimit: 5000000,
      }
    default:
      return {
        scenarioLimit: 0,
        aiInsightsLimit: 0,
        transactionVolumeLimit: 0,
      }
  }
}

export async function POST(req: Request) {
  const supabase = getSupabaseAdminClient()
  let event: Stripe.Event

  // Lire le corps de la requête sous forme de texte brut
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature') as string

  // Déterminer la clé secrète de webhook (locale ou production)
  const webhookSecret =
    process.env.NODE_ENV === 'development' && process.env.STRIPE_WEBHOOK_SECRET_LOCAL
      ? process.env.STRIPE_WEBHOOK_SECRET_LOCAL
      : process.env.STRIPE_WEBHOOK_SECRET!

  try {
    // 1. Vérification de la signature Stripe
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err: any) {
    console.error(`❌ Signature verification failed: ${err.message}`)
    // Retourne 400 pour Stripe en cas d'échec de vérification
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 })
  }

  // 2. Traitement des événements
  try {
    const eventType = event.type

    switch (eventType) {
      // ===============================================
      // 🔹 Customer created (ou mis à jour) : Crée la liaison Stripe Customer ID <-> Supabase User ID
      case 'customer.created':
      case 'customer.updated': {
        const customer = event.data.object as Stripe.Customer
        const supabaseUserId = customer.metadata.supabase_user_id

        if (!supabaseUserId) {
          console.warn(
            `⚠️ Skipping DB update: Stripe Customer ${customer.id} is missing 'supabase_user_id' metadata.`
          )
          break
        }

        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ stripe_customer_id: customer.id })
          .eq('user_id', supabaseUserId)

        if (updateError) {
          console.error('❌ DB Customer update failed:', updateError)
        } else {
          console.log(`✅ Stripe Customer ID updated for user: ${supabaseUserId}`)
        }
        break
      }

      // ===============================================
      // 🔹 Subscription created / updated (mise à niveau) : Met à jour le plan et les limites
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string

        // VÉRIFICATION ESSENTIELLE DE LA STRUCTURE D'ABONNEMENT
        if (!sub.items.data || sub.items.data.length === 0 || !sub.items.data[0].price) {
          console.error("🛑 ERREUR : L'abonnement est sans Price ID. Skipping update.")
          return new NextResponse(null, { status: 200 })
        }

        const tier = sub.items.data[0].price.metadata.tier || 'starter'
        console.log(`📝 Subscription created/updated: ${sub.id} Tier: ${tier}`)

        const usageLimits = getUsageLimits(tier)

        // REMETTEZ CES LIGNES :
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('stripe_customer_id', customerId) // ⬅️ Re-activez la recherche
          .maybeSingle()

        // NOUVELLE LOGIQUE DE MISE À JOUR (si le profil existe)
        if (profile?.user_id) {
          const subscription_start = sub.current_period_start
            ? new Date(sub.current_period_start * 1000).toISOString()
            : null
          const subscription_end = sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null

          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({
              subscription_tier: tier,
              subscription_status: sub.status,
              stripe_subscription_id: sub.id,
              monthly_scenario_limit: usageLimits.scenarioLimit,
              monthly_ai_insights_limit: usageLimits.aiInsightsLimit,
              monthly_transaction_volume_limit: usageLimits.transactionVolumeLimit,
              subscription_started_at: subscription_start,
              subscription_ends_at: subscription_end,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', profile.user_id)

          if (updateError) {
            console.error('🛑 ERREUR CRITIQUE DE MISE À JOUR DB (Sub Update):', updateError)
          } else {
            console.log(`✅ User profile updated to tier: ${tier}`)
          }
        } else {
          // Log d'erreur clair si la liaison DB/Stripe est manquante
          console.error(
            `🛑 ERREUR : Profil utilisateur Supabase non trouvé pour Stripe Customer ID: ${customerId}`
          )
        }
        break
      }

      // ===============================================
      // 🔹 Subscription deleted (Annulation / Rétrogradation)
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string

        console.log('⚠️ Subscription canceled:', sub.id)

        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        if (profileError) {
          console.error('❌ Erreur de recherche de profil (Deleted):', profileError)
        }

        if (profile?.user_id) {
          const starterLimits = getUsageLimits('starter')

          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({
              subscription_tier: 'starter',
              subscription_status: 'canceled',
              stripe_subscription_id: null,
              monthly_scenario_limit: starterLimits.scenarioLimit,
              monthly_ai_insights_limit: starterLimits.aiInsightsLimit,
              monthly_transaction_volume_limit: starterLimits.transactionVolumeLimit,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', profile.user_id)

          if (updateError) {
            console.error('🛑 ERREUR CRITIQUE DE MISE À JOUR DB (Sub Deleted):', updateError)
          } else {
            console.log(`✅ Downgraded user to starter tier`)
          }
        }
        break
      }

      // ===============================================
      // 🔹 Gestion des paiements
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        console.log(`✅ Invoice paid: ${invoice.id}`)
        break
      }

      // ===============================================
      // 🔹 Autres événements non gérés
      default:
        console.info(`ℹ️ Unhandled event: ${eventType}`)
        break
    }

    // 3. Réponse Stripe
    // Retourne 200 pour Stripe pour accuser réception
    return new NextResponse(null, { status: 200 })
  } catch (error: any) {
    // 4. Gestion des erreurs internes: generate error code and log stack
    const errRes = handleApiError(error, 'WEBHOOK')
    return NextResponse.json(errRes, { status: 500 })
  }
}
