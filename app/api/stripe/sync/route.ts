import { NextRequest, NextResponse } from 'next/server'
import { createMetricsEngine } from '@/lib/stripe-metrics' // Doit inclure setSyncStatus
import { handleApiError } from '@/lib/server-error'
import { withRateLimit } from '@/lib/rate-limit'
import { validateRequestBody, SyncRequestSchema, ValidationError } from '@/lib/validation-schemas'
import { getSupabaseServerClient } from '@/lib/supabase/server' 
import { getSupabaseAdminClient } from '@/lib/server-clients'

/**
 * POST /api/stripe/sync - Déclenche la synchronisation asynchrone
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdminClient()
  // ✅ Rate limiting
  const rateLimitResponse = await withRateLimit(req, 'sync')
  if (rateLimitResponse) return rateLimitResponse
  
  try {
    // 1. Tenter la vérification du CRON SECRET
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isCronRequest = authHeader === `Bearer ${cronSecret}`
    
    // 2. Tenter la vérification de l'utilisateur connecté
    let user = null;
    let isUserRequest = false;
    try {
      const supabaseServer = await getSupabaseServerClient() 
      const { data: { user: authUser } } = await supabaseServer.auth.getUser(); 
      
      user = authUser;
      isUserRequest = !!user;
    } catch (e) {
      console.warn('⚠️ Authentication failed in /api/sync:', e);
    }

    // 3. Condition d'autorisation
    if (!isCronRequest && !isUserRequest) {
      return NextResponse.json(
        { error: 'Unauthorized: User session or CRON secret required.' }, 
        { status: 401 }
      )
    }
    
    // ✅ Validate input
    const { connectionId, stripeAccountId, force } = await validateRequestBody(
      req,
      SyncRequestSchema
    )
    
    console.log('🔄 Sync requested:', { connectionId, stripeAccountId, force })
    
    // Determine which connection(s) to sync
    let connections: any[] = []
    
    // ... (Logique de détermination des connexions à synchroniser) ...
    // NOTE: Logique de recherche modifiée pour sélectionner uniquement les champs nécessaires
    if (connectionId) {
      const { data, error } = await supabase
        .from('stripe_connections')
        .select('id, stripe_account_id')
        .eq('id', connectionId)
        .eq('is_active', true)
        .single()
      
      if (error || !data) {
        return NextResponse.json(
          { error: 'Connection not found' },
          { status: 404 }
        )
      }
      connections = [data]
    } else if (stripeAccountId) {
      const { data, error } = await supabase
        .from('stripe_connections')
        .select('id, stripe_account_id')
        .eq('stripe_account_id', stripeAccountId)
        .eq('is_active', true)
        .single()
      
      if (error || !data) {
        return NextResponse.json(
          { error: 'Connection not found' },
          { status: 404 }
        )
      }
      connections = [data]
    } else {
      const { data, error } = await supabase
        .from('stripe_connections')
        .select('id, stripe_account_id')
        .eq('is_active', true)
      
      if (error) {
        throw error
      }
      connections = data || []
    }
    
    console.log(`📊 Found ${connections.length} connection(s) to sync`)
    
    // Sync each connection
    const results = []

    for (const connection of connections) {
      const connectionId = connection.id;
      const stripeAccountId = connection.stripe_account_id;
      
      try {
        console.log(`\n🔄 Syncing (Async): ${stripeAccountId}`)
        
        const engine = await createMetricsEngine(connectionId, supabase)
        
        // 🛑 ÉTAPE 1 : ENREGISTRER L'ÉTAT INITIAL 'SYNCING'
        // 'setSyncStatus' DOIT être implémenté dans votre moteur de métriques
        await engine.setSyncStatus('syncing', 5, 'Starting sync job...'); 

        // 🛑 ÉTAPE 2 : DÉCLENCHER LE TRAVAIL EN ARRIÈRE-PLAN
        // ON N'UTILISE PAS 'await' ici pour que la requête HTTP puisse se terminer rapidement
        engine.syncMetrics(force) 
          .then(() => {
            console.log(`✅ Synced (Async finished): ${stripeAccountId}`);
            // Le moteur doit mettre à jour le statut final dans la DB (par ex: 'ready')
          })
          .catch(async (error) => {
            console.error(`❌ Failed to sync (Async error): ${stripeAccountId}`, error);
            // Mettre à jour le statut dans la DB en cas d'échec
            await engine.setSyncStatus('error', 100, `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          });
        
        // 🛑 L'API répond immédiatement avec un statut "triggered"
        results.push({
          connectionId: connectionId,
          stripeAccountId: stripeAccountId,
          status: 'triggered',
        })
        
      } catch (error) {
        console.error(`❌ Failed to trigger sync for ${stripeAccountId}:`, error)
        
        results.push({
          connectionId: connectionId,
          stripeAccountId: stripeAccountId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Return results
    const successCount = results.filter(r => r.status === 'triggered').length
    const failCount = results.filter(r => r.status === 'error').length

    // 🛑 Réponse 202 ACCEPTED
    return NextResponse.json({
      success: true,
      message: `Triggered ${successCount} sync job(s), ${failCount} failed to start.`,
      results,
    }, { status: 202 })
    
  } catch (error) {
    // ✅ Handle validation errors separately
    if (error instanceof ValidationError) {
      return NextResponse.json(error.toJSON(), { status: 400 })
    }
    // Handle unexpected errors: generate error code and log stack
    const errRes = handleApiError(error, 'SYNC_POST')
    return NextResponse.json(errRes, { status: 500 })
  }
}

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------

/**
 * GET /api/stripe/sync?connectionId=xxx - Récupère le statut de progression
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const searchParams = request.nextUrl.searchParams
    const connectionId = searchParams.get('connectionId')
    
    if (!connectionId) {
      return NextResponse.json(
        { error: 'connectionId required' },
        { status: 400 }
      )
    }
    
    // 1. Get connection details, Y COMPRIS LES CHAMPS DE STATUT
    const { data: connection, error: connError } = await supabase
      .from('stripe_connections')
      .select('id, stripe_account_id, last_synced_at, sync_status, sync_progress, sync_message')
      .eq('id', connectionId)
      .single()
    
    if (connError || !connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      )
    }
    
    // 2. Traduction de l'état de la DB pour le Hook Client
    
    let currentStage: string;
    let progress: number;
    let message: string;
    
    const dbStatus = connection.sync_status;

    if (dbStatus === 'syncing') {
        currentStage = 'SYNCING';
        progress = connection.sync_progress || 5;
        message = connection.sync_message || 'Synchronisation en cours...';
    } else if (dbStatus === 'error') {
        currentStage = 'ERROR';
        progress = 100;
        message = connection.sync_message || 'Erreur critique lors de la synchronisation.';
    } else if (dbStatus === 'ready' && connection.last_synced_at) {
        currentStage = 'COMPLETED';
        progress = 100;
        message = `Dernière synchronisation le ${new Date(connection.last_synced_at).toLocaleString()}.`;
    } else {
        // IDLE ou premier démarrage
        currentStage = 'IDLE';
        progress = 0;
        message = 'Cliquez sur "Sync Now" pour démarrer.';
    }

    // 3. Renvoi des données nécessaires au hook useSyncStatus
    return NextResponse.json({
      currentStage: currentStage,
      progress: progress,
      message: message,
      lastSyncedAt: connection.last_synced_at,
    })
    
  } catch (error) {
    // Handle unexpected errors: generate error code and log stack
    const errRes = handleApiError(error, 'SYNC_GET')
    return NextResponse.json(errRes, { status: 500 })
  }
}
