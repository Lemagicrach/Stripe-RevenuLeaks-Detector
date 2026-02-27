import { z } from 'zod'

/**
 * ✅ FIX #4: Complete input validation schemas
 * Use these in ALL API routes to prevent malformed data
 */

// ==========================================
// Stripe Connect Schemas
// ==========================================

export const StripeConnectCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code required').optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
})

export const StripeAccountIdSchema = z.object({
  stripeAccountId: z.string().regex(
    /^acct_[a-zA-Z0-9]{16,}$/,
    'Invalid Stripe account ID format'
  ),
})

// ==========================================
// Sync Operation Schemas
// ==========================================

export const SyncRequestSchema = z.object({
  stripeAccountId: z.string().regex(
    /^acct_[a-zA-Z0-9]{16,}$/,
    'Invalid Stripe account ID'
  ).optional(),
  connectionId: z.string().uuid('Invalid connection ID').optional(),
  force: z.boolean().optional().default(false),
})

export const SyncAllRequestSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(10),
  offset: z.number().int().min(0).optional().default(0),
})

// ==========================================
// Metrics Query Schemas
// ==========================================

export const MetricsQuerySchema = z.object({
  connectionId: z.string().uuid('Invalid connection ID').optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  granularity: z.enum(['day', 'week', 'month']).optional().default('month'),
})

export const DateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
}).refine(
  data => new Date(data.startDate) <= new Date(data.endDate),
  'Start date must be before or equal to end date'
)

// ==========================================
// Webhook Schemas
// ==========================================

export const StripeWebhookEventSchema = z.object({
  id: z.string().startsWith('evt_'),
  type: z.string(),
  data: z.object({
    object: z.any(),
  }),
  created: z.number(),
  livemode: z.boolean(),
})

// ==========================================
// Utility Functions
// ==========================================

/**
 * Validate request body with Zod schema
 * Returns parsed data or throws validation error
 */
export async function validateRequestBody<T>(
  req: Request,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    const body = await req.json()
    return schema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        'Invalid request body',
        error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }))
      )
    }
    throw error
  }
}

/**
 * Validate query parameters with Zod schema
 */
export function validateQueryParams<T>(
  url: string,
  schema: z.ZodSchema<T>
): T {
  try {
    const searchParams = new URL(url).searchParams
    const params = Object.fromEntries(searchParams.entries())
    return schema.parse(params)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        'Invalid query parameters',
        error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }))
      )
    }
    throw error
  }
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: Array<{ field: string; message: string }>
  ) {
    super(message)
    this.name = 'ValidationError'
  }
  
  toJSON() {
    return {
      error: this.message,
      details: this.errors,
    }
  }
}