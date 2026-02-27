import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Environment variables for Upstash
const redisUrl = process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

// Determine if Upstash Redis is configured
const isRedisConfigured = Boolean(redisUrl && redisToken)

// Strict rate limit for OAuth (prevent credential stuffing)
const oauthRateLimit = isRedisConfigured
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, '60 s'), // 5 requests per minute
      analytics: true,
    })
  : null

// Standard rate limit for sync operations
const syncRateLimit = isRedisConfigured
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, '60 s'), // 10 requests per minute
      analytics: true,
    })
  : null

// Lenient rate limit for metrics viewing
const metricsRateLimit = isRedisConfigured
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(30, '60 s'), // 30 requests per minute
      analytics: true,
    })
  : null

// Rate limit for AI insights generation
const insightsRateLimit = isRedisConfigured
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, '60 s'), // 10 requests per minute
      analytics: true,
    })
  : null

// Webhook rate limit
const webhookRateLimit = isRedisConfigured
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(100, '60 s'), // 100 requests per minute
      analytics: true,
    })
  : null

// -------------------------------------------------------
// Fallback rate limiting when Redis isn't configured
// -------------------------------------------------------
// Static fallback configuration: 100 requests per minute per IP
const FALLBACK_LIMIT = 100
const FALLBACK_WINDOW_MS = 60_000

// Keep counters on the global object so they persist across invocations
interface FallbackRecord {
  count: number
  reset: number
}

type RateLimitType =
  | 'oauth'
  | 'sync'
  | 'metrics'
  | 'webhook'
  | 'insights'
  | 'admin:data-mode'
  | 'cron-detect-signals'

type RouteHandler<TContext = { params: Promise<Record<string, string | string[] | undefined>> }> = (
  req: NextRequest,
  context?: TContext
) => any

declare global {
  // eslint-disable-next-line no-var
  var __fallbackCount: Record<string, FallbackRecord> | undefined
}

/**
 * Rate limiting middleware.  When Upstash Redis is configured this
 * delegates to the configured Ratelimit instances.  If Redis is not
 * configured, a static fallback limit of 100 requests per minute is
 * enforced per IP address.  A warning is logged once when the fallback
 * first takes effect.
 */
async function applyRateLimit(
  req: NextRequest,
  type: RateLimitType = 'sync'
): Promise<NextResponse | null> {
  // Identify the client
  const identifier = getIdentifier(req)

  // ---------------------------------------------
  // Static fallback if Redis is not available
  // ---------------------------------------------
  if (!isRedisConfigured) {
    // Initialize the fallback store and log a warning once
    if (!globalThis.__fallbackCount) {
      globalThis.__fallbackCount = {}
      console.warn(
        `⚠️ Rate limiting disabled: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN not configured. Using static fallback limit of ${FALLBACK_LIMIT} requests per minute.`
      )
    }
    const now = Date.now()
    const record = globalThis.__fallbackCount[identifier] || {
      count: 0,
      reset: now + FALLBACK_WINDOW_MS,
    }
    if (now > record.reset) {
      // Reset the window
      globalThis.__fallbackCount[identifier] = {
        count: 1,
        reset: now + FALLBACK_WINDOW_MS,
      }
    } else if (record.count >= FALLBACK_LIMIT) {
      // Exceeded the fallback limit
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    } else {
      // Increment the count
      record.count += 1
      globalThis.__fallbackCount[identifier] = record
    }
    // Allow request to proceed
    return null
  }

  // ---------------------------------------------
  // Upstash Redis based rate limiting
  // ---------------------------------------------
  const limiter = {
    oauth: oauthRateLimit,
    sync: syncRateLimit,
    metrics: metricsRateLimit,
    webhook: webhookRateLimit,
    insights: insightsRateLimit,
    'admin:data-mode': syncRateLimit,
    'cron-detect-signals': syncRateLimit,
  }[type]

  // If limiter is undefined/null, skip rate limiting
  if (!limiter) {
    return null
  }

  // Check the rate limit via Upstash
  const { success, limit, reset, remaining } = await limiter.limit(identifier)

  if (!success) {
    // Deny the request with proper rate limit headers
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: `Too many requests. Try again in ${Math.ceil(
          (reset - Date.now()) / 1000
        )} seconds.`,
        limit,
        reset: new Date(reset).toISOString(),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
        },
      }
    )
  }

  // Pass through
  return null
}

export function withRateLimit<TContext = { params: Promise<Record<string, string | string[] | undefined>> }>(
  handler: RouteHandler<TContext>,
  type?: RateLimitType
): (req: NextRequest, context?: TContext) => Promise<any>
export function withRateLimit(req: NextRequest, type?: RateLimitType): Promise<NextResponse | null>
export function withRateLimit<TContext = { params: Promise<Record<string, string | string[] | undefined>> }>(
  arg1: NextRequest | RouteHandler<TContext>,
  type: RateLimitType = 'sync'
) {
  if (typeof arg1 === 'function') {
    const handler = arg1
    return async (req: NextRequest, context?: TContext): Promise<any> => {
      const blocked = await applyRateLimit(req, type)
      if (blocked) return blocked
      return handler(req, context)
    }
  }

  return applyRateLimit(arg1, type)
}

/**
 * Determine the client identifier based on request headers.  Uses
 * X-Forwarded-For or X-Real-IP when available, otherwise falls back
 * to 'anonymous'.
 */
function getIdentifier(req: NextRequest): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'anonymous'
  return `ip:${ip}`
}
