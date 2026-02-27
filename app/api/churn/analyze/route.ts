import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { ChurnPredictionEngine } from '@/lib/churn-prediction'
import { decrypt } from '@/lib/encryption'
import { handleApiError } from '@/lib/server-error'
import { getSupabaseAdminClient } from '@/lib/server-clients'

// POST /api/churn/analyze - Analyze churn risk for a connection
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const { connectionId } = await request.json()

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID required' }, { status: 400 })
    }

    // Get connection details
    const { data: connection, error: connectionError } = await supabase
      .from('stripe_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('is_active', true)
      .single()

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    // Decrypt access token (note: ensure iv and auth_tag are stored correctly)
    const accessToken = decrypt(
      connection.access_token,
      process.env.ENCRYPTION_KEY!,
      connection.auth_tag
    )
    const stripe = new Stripe(accessToken, { apiVersion: '2023-10-16' })

    // Initialize prediction engine
    const engine = new ChurnPredictionEngine(stripe, connectionId)

    // Analyze all subscriptions
    const predictions = await engine.analyzeAllSubscriptions()

    // Get summary statistics
    const summary = {
      total_analyzed: predictions.length,
      high_risk_count: predictions.filter((p) => p.riskLevel === 'high').length,
      critical_risk_count: predictions.filter((p) => p.riskLevel === 'critical').length,
      total_mrr_at_risk: predictions.reduce((sum, p) => sum + p.mrrAtRisk, 0),
      avg_risk_score:
        predictions.length > 0
          ? predictions.reduce((sum, p) => sum + p.riskScore, 0) / predictions.length
          : 0,
    }

    return NextResponse.json({
      success: true,
      summary,
      predictions: predictions.filter((p) => p.riskLevel !== 'low'), // Return only actionable risks
    })
  } catch (error: any) {
    // Unexpected error: return standardized error with unique code
    const errRes = handleApiError(error, 'CHURN_ANALYZE')
    return NextResponse.json(errRes, { status: 500 })
  }
}

// GET /api/churn/analyze?connectionId=xxx - Fetch recent churn predictions
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId')

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID required' }, { status: 400 })
    }

    // Get recent predictions
    const { data: predictions, error } = await supabase
      .from('churn_predictions')
      // Select only necessary columns to avoid leaking sensitive data
      .select(
        'stripe_customer_id, risk_level, mrr_at_risk, churn_probability, created_at'
      )
      .eq('stripe_connection_id', connectionId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      const errRes = handleApiError(error, 'CHURN_ANALYZE_GET')
      return NextResponse.json(errRes, { status: 500 })
    }

    // Calculate summary
    const highRisk = predictions.filter(
      (p: any) => p.risk_level === 'high' || p.risk_level === 'critical'
    )
    const totalMrrAtRisk = predictions.reduce(
      (sum: number, p: any) => sum + (p.mrr_at_risk || 0),
      0
    )

    return NextResponse.json({
      success: true,
      predictions,
      summary: {
        total: predictions.length,
        high_risk: highRisk.length,
        total_mrr_at_risk: totalMrrAtRisk,
      },
    })
  } catch (error: any) {
    // Unexpected error: return standardized error with unique code
    const errRes = handleApiError(error, 'CHURN_ANALYZE_GET')
    return NextResponse.json(errRes, { status: 500 })
  }
}
