import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from './encryption'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import { SafeStripeClient, stripeWithRetry } from './safe-stripe'
import { getSupabaseAdminClient } from './server-clients'

// Définition des types d'état (à garder synchrone avec le frontend)
type SyncStatus = 'ready' | 'syncing' | 'error'

export class StripeMetricsEngine {
  private stripe: Stripe
  private connectionId: string
  private stripeAccountId: string
  
  constructor(accessToken: string, connectionId: string, stripeAccountId: string) {
    this.stripe = new Stripe(accessToken, {
      apiVersion: '2023-10-16',
    })
    this.connectionId = connectionId
    this.stripeAccountId = stripeAccountId
  }
  
  // --- NOUVELLE MÉTHODE DE GESTION DU STATUT ---
  /**
   * Met à jour le statut de la synchronisation (progress, status, message) dans la DB.
   * C'est la source de données pour l'API GET /api/stripe/sync.
   */
  async setSyncStatus(status: SyncStatus, progress: number, message: string): Promise<void> {
    const supabase = getSupabaseAdminClient()
    const updateObject: Record<string, any> = {
      sync_status: status,
      sync_progress: progress,
      sync_message: message,
    };

    // Si la synchronisation est COMPLÈTE, nous mettons à jour la date de dernière synchronisation
    if (status === 'ready' && progress === 100) {
      updateObject.last_synced_at = new Date().toISOString();
    }
    
    // Si la synchronisation est en ERREUR, nous mettons à jour la date de dernière tentative
    if (status === 'error') {
        updateObject.last_sync_attempt_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('stripe_connections')
      .update(updateObject)
      .eq('id', this.connectionId);

    if (error) {
      console.error('❌ Erreur de mise à jour du statut de synchronisation:', error);
      // Ne pas jeter d'erreur ici, car nous ne voulons pas arrêter le worker principal
    }
  }

  /**
   * Main sync function - calculates and saves all metrics
   * 🛑 Maintenant avec gestion des statuts à chaque étape.
   */
  async syncMetrics(fullSync: boolean = false): Promise<void> {
    console.log(`🔄 Starting ${fullSync ? 'FULL' : 'incremental'} sync for ${this.stripeAccountId}`)
    
    try {
      // Step 0: Définir l'état initial (Déjà fait dans l'API POST, mais bonne pratique)
      await this.setSyncStatus('syncing', 5, 'Vérification de la connexion...'); 
      
      // Step 1: Fetch and cache subscriptions
      await this.setSyncStatus('syncing', 25, 'Récupération des abonnements Stripe...'); 
      await this.syncSubscriptions()
      
      // Step 2: Fetch and cache customers
      await this.setSyncStatus('syncing', 45, 'Récupération des informations clients Stripe...');
      await this.syncCustomers()

      // Step 2.5: Fetch and cache invoices (for Revenue Leak Detector)
      await this.setSyncStatus('syncing', 55, 'Récupération des factures Stripe (leak detection)...');
      await this.syncInvoices()
      
      // Step 3: Calculate current metrics
      await this.setSyncStatus('syncing', 65, 'Calcul des métriques actuelles (MRR, ARPU)...');
      const metrics = await this.calculateCurrentMetrics()
      
      // Step 4: Save metrics snapshot
      await this.setSyncStatus('syncing', 85, 'Sauvegarde des données dans la base...');
      await this.saveMetricsSnapshot(metrics)
      
      // Step 5: Update final status (remplace updateLastSynced)
      await this.setSyncStatus('ready', 100, 'Synchronisation terminée avec succès.');
      
      console.log('✅ Sync complete!')
    } catch (error) {
      // 🛑 EN CAS D'ERREUR: Mettre le statut à 'error'
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      await this.setSyncStatus('error', 100, `Échec de la synchronisation: ${errorMessage}`);
      console.error('❌ Sync failed:', error)
      throw error // Rejeter l'erreur pour la fonction .catch() de l'API POST
    }
  }
  
  // 🛑 LA FONCTION updateLastSynced EST OBSOLÈTE et peut être retirée
  // puisqu'elle est gérée par setSyncStatus('ready', 100, ...)
  // private async updateLastSynced(): Promise<void> {
  //   // ... cette fonction n'est plus nécessaire ...
  // }

  /**
   * Fetch and cache all active subscriptions
   * ✅ Now with retry protection
   */
  private async syncSubscriptions(): Promise<void> {
    const supabase = getSupabaseAdminClient()
    console.log('📥 Fetching subscriptions from Stripe...')
    
    // ✅ Use SafeStripeClient for automatic retry
    const safeStripe = new SafeStripeClient(this.stripe)
    
    try {
      // ✅ This handles pagination AND retries automatically
      const subscriptions = await safeStripe.listAllSubscriptions({
        status: 'all', // Get all statuses
      })
      
      console.log(`✅ Fetched ${subscriptions.length} subscriptions`)
      
      // Cache subscriptions in database
      for (const sub of subscriptions) {
        const item = sub.items.data[0]
        const price = item?.price
        
        await supabase
          .from('subscriptions_cache')
          .upsert({
            stripe_connection_id: this.connectionId,
            subscription_id: sub.id,
            customer_id: sub.customer as string,
            status: sub.status,
            mrr_amount: this.calculateSubMRR(sub),
            interval: price?.recurring?.interval || null,
            currency: sub.currency.toUpperCase(),
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            created_at_stripe: new Date(sub.created * 1000).toISOString(),
            canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
            ended_at: sub.ended_at ? new Date(sub.ended_at * 1000).toISOString() : null,
            plan_name: price?.product && typeof price.product !== 'string' ? (price.product as any).name : null,
            price_id: price?.id || null,
            quantity: item?.quantity || 1,
            synced_at: new Date().toISOString(),
          })
      }
      
      console.log('✅ Cached subscriptions in database')
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error)
      throw error
    }
  }
  
  /**
   * Fetch and cache customer data
   * ✅ Now with retry protection
   */
  private async syncCustomers(): Promise<void> {
    const supabase = getSupabaseAdminClient()
    console.log('📥 Fetching customers from Stripe...')
    
    // ✅ Use SafeStripeClient for automatic retry
    const safeStripe = new SafeStripeClient(this.stripe)
    
    try {
      // ✅ This handles pagination AND retries automatically
      const customers = await safeStripe.listAllCustomers()
      
      console.log(`✅ Fetched ${customers.length} customers`)
      
      // Cache customers in database
      for (const customer of customers) {
        await supabase
          .from('customers_cache')
          .upsert({
            stripe_connection_id: this.connectionId,
            customer_id: customer.id,
            email: customer.email,
            name: customer.name,
            created_at_stripe: new Date(customer.created * 1000).toISOString(),
            synced_at: new Date().toISOString(),
          })
      }
      
      console.log('✅ Cached customers in database')
    } catch (error) {
      console.error('Failed to fetch customers:', error)
      throw error
    }
  }
  
  /**
   * Fetch and cache invoices (Revenue Leak Detector)
   * ✅ Uses SafeStripeClient for pagination + retries
   */
  private async syncInvoices(): Promise<void> {
    const supabase = getSupabaseAdminClient()
    console.log('📥 Fetching invoices from Stripe...')

    const safeStripe = new SafeStripeClient(this.stripe)

    try {
      // Get last 60 days invoices (enough for 30d leak detection + buffer)
      const since = Math.floor((Date.now() - 60 * 24 * 60 * 60 * 1000) / 1000)

      const invoices = await safeStripe.listAllInvoices({
        created: { gte: since },
      })

      console.log(`✅ Fetched ${invoices.length} invoices`)

      for (const inv of invoices) {
        await supabase
          .from('invoices_cache')
          .upsert({
            stripe_connection_id: this.connectionId,
            invoice_id: inv.id,
            customer_id: typeof inv.customer === 'string' ? inv.customer : inv.customer?.id,
            subscription_id: typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id,
            status: inv.status || 'unknown',
            amount_due_cents: inv.amount_due ?? 0,
            amount_paid_cents: inv.amount_paid ?? 0,
            attempt_count: inv.attempt_count ?? 0,
            next_payment_attempt: inv.next_payment_attempt
              ? new Date(inv.next_payment_attempt * 1000).toISOString()
              : null,
            hosted_invoice_url: inv.hosted_invoice_url ?? null,
            created_at_stripe: inv.created ? new Date(inv.created * 1000).toISOString() : null,
            updated_at_stripe: (inv as any).status_transitions?.paid_at
              ? new Date((inv as any).status_transitions.paid_at * 1000).toISOString()
              : null,
            synced_at: new Date().toISOString(),
          })
      }

      console.log('✅ Cached invoices in database')
    } catch (error) {
      console.error('Failed to fetch invoices:', error)
      throw error
    }
  }


  /**
   * Calculate current metrics
   */
  private async calculateCurrentMetrics() {
    const supabase = getSupabaseAdminClient()
    console.log('🧮 Calculating metrics...')
    
    const today = new Date()
    
    // Get active subscriptions from cache
    const { data: activeSubs } = await supabase
      .from('subscriptions_cache')
      .select('*')
      .eq('stripe_connection_id', this.connectionId)
      .eq('status', 'active')
    
    // Calculate MRR
    const mrr =
      activeSubs?.reduce(
        (sum: number, sub: any) => sum + (sub.mrr_amount || 0),
        0
      ) || 0
    
    // Calculate ARR
    const arr = mrr * 12
    
    // Get total customers
    const { count: totalCustomers } = await supabase
      .from('customers_cache')
      .select('*', { count: 'exact', head: true })
      .eq('stripe_connection_id', this.connectionId)
    
    // Calculate ARPU
    const arpu = totalCustomers && totalCustomers > 0 ? mrr / totalCustomers : 0
    
    // Calculate churn (compare to last month)
    const churnRates = await this.calculateChurnRate()
    
    // MRR Movement
    const mrrMovement = await this.calculateMRRMovement()
    
    const metrics = {
      snapshot_date: format(today, 'yyyy-MM-dd'),
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(arr * 100) / 100,
      total_revenue: Math.round(mrr * 100) / 100, // Simplified for now
      new_mrr: mrrMovement.newMRR,
      expansion_mrr: mrrMovement.expansionMRR,
      contraction_mrr: mrrMovement.contractionMRR,
      churned_mrr: mrrMovement.churnedMRR,
      reactivation_mrr: 0, // TODO: Implement
      total_customers: totalCustomers || 0,
      active_subscriptions: activeSubs?.length || 0,
      new_customers: 0, // TODO: Calculate from this month
      churned_customers: 0, // TODO: Calculate from this month
      arpu: Math.round(arpu * 100) / 100,
      ltv: Math.round((arpu * 12) * 100) / 100, // Simplified: assume 12 month lifetime
      customer_churn_rate: churnRates.customerChurnRate,
      revenue_churn_rate: churnRates.revenueChurnRate,
    }
    
    console.log('✅ Metrics calculated:', metrics)
    return metrics
  }
  
  /**
   * Calculate MRR for a single subscription
   */
  private calculateSubMRR(subscription: Stripe.Subscription): number {
    const item = subscription.items.data[0]
    if (!item?.price) return 0
    
    const price = item.price
    const quantity = item.quantity || 1
    const unitAmount = price.unit_amount || 0
    
    // Convert to dollars
    let monthlyAmount = (unitAmount / 100) * quantity
    
    // Normalize to monthly
    if (price.recurring?.interval === 'year') {
      monthlyAmount = monthlyAmount / 12
    } else if (price.recurring?.interval === 'week') {
      monthlyAmount = monthlyAmount * 4.33
    } else if (price.recurring?.interval === 'day') {
      monthlyAmount = monthlyAmount * 30
    }
    
    return monthlyAmount
  }
  
  /**
   * Calculate MRR movement (new, expansion, contraction, churned)
   */
  private async calculateMRRMovement() {
    const supabase = getSupabaseAdminClient()
    // Get subscriptions from this month and last month
    const thisMonth = startOfMonth(new Date())
    const lastMonth = startOfMonth(subMonths(new Date(), 1))
    
    const { data: currentSubs } = await supabase
      .from('subscriptions_cache')
      .select('*')
      .eq('stripe_connection_id', this.connectionId)
      .eq('status', 'active')
    
    // Simplified calculation - in production, compare with previous snapshot
    let newMRR = 0
    let expansionMRR = 0
    let contractionMRR = 0
    let churnedMRR = 0
    
    // For now, just return zeros - we'll implement proper calculation once we have historical data
    return {
      newMRR: Math.round(newMRR * 100) / 100,
      expansionMRR: Math.round(expansionMRR * 100) / 100,
      contractionMRR: Math.round(contractionMRR * 100) / 100,
      churnedMRR: Math.round(churnedMRR * 100) / 100,
    }
  }
  
  /**
   * Calculate churn rate
   */
  private async calculateChurnRate() {
    // Simplified - return 0 for now
    // In production, compare current month to previous month
    return {
      customerChurnRate: 0,
      revenueChurnRate: 0,
    }
  }
  
  /**
   * Save metrics snapshot to database
   */
  private async saveMetricsSnapshot(metrics: any): Promise<void> {
    const supabase = getSupabaseAdminClient()
    console.log('💾 Saving metrics snapshot...')
    console.log('🔍 DEBUG: this.connectionId =', this.connectionId)
    console.log('🔍 DEBUG: this.stripeAccountId =', this.stripeAccountId)
    
  const { error } = await supabase
  .from('metrics_snapshots')
  .upsert(
    {
      stripe_connection_id: this.connectionId,
      ...metrics,
    },
    {
      onConflict: 'stripe_connection_id,snapshot_date'
    }
  )
    
    if (error) {
      console.error('❌ Failed to save metrics:', error)
      throw error
    }
    
    console.log('✅ Metrics snapshot saved')
  }
  
  // 🛑 updateLastSynced A ÉTÉ RETIRÉE (gérée par setSyncStatus)
}

/**
 * Create metrics engine from connection ID
 */
export async function createMetricsEngine(connectionId: string, supabase: any): Promise<StripeMetricsEngine> {
  console.log('🔍 DEBUG createMetricsEngine: connectionId parameter =', connectionId)
  const { data: connection, error } = await supabase
    .from('stripe_connections')
    .select('id, access_token_enc, iv, auth_tag, stripe_account_id')
    .eq('id', connectionId)
    .eq('is_active', true)
    .single()
  
  if (error || !connection) {
    throw new Error('Failed to fetch Stripe connection')
  }
  
  const accessToken = decrypt(
  connection.access_token_enc, 
  connection.iv, 
  connection.auth_tag 
)
  
  return new StripeMetricsEngine(
    accessToken,
    connectionId,
    connection.stripe_account_id
  )
}
