import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * Health check endpoint for monitoring and load balancers
 * Returns 200 if all systems operational, 503 if degraded
 */
export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    checks: {
      database: { status: 'unknown' as 'ok' | 'error' | 'unknown', latency: 0 },
      env: { status: 'unknown' as 'ok' | 'error' | 'unknown' },
      stripe: { status: 'unknown' as 'ok' | 'error' | 'unknown' },
    }
  }

  // Check environment variables
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'STRIPE_SECRET_KEY',
    'ENCRYPTION_KEY',
  ]

  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar])

  if (missingEnvVars.length > 0) {
    checks.checks.env.status = 'error'
    checks.status = 'unhealthy'
    console.error('Missing environment variables:', missingEnvVars)
  } else {
    checks.checks.env.status = 'ok'
  }

  // Check database connection
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    const startTime = Date.now()
    const { error } = await supabase.from('user_profiles').select('id').limit(1)
    const latency = Date.now() - startTime

    if (error) {
      checks.checks.database.status = 'error'
      checks.status = 'unhealthy'
      console.error('Database health check failed:', error)
    } else {
      checks.checks.database.status = 'ok'
      checks.checks.database.latency = latency
    }
  } catch (error) {
    checks.checks.database.status = 'error'
    checks.status = 'unhealthy'
    console.error('Database connection error:', error)
  }

  // Check Stripe configuration
  try {
    if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_')) {
      checks.checks.stripe.status = 'error'
      checks.status = 'degraded'
    } else {
      checks.checks.stripe.status = 'ok'
    }
  } catch (error) {
    checks.checks.stripe.status = 'error'
    checks.status = 'degraded'
  }

  const statusCode = checks.status === 'healthy' ? 200 : 503

  return NextResponse.json(checks, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    }
  })
}
