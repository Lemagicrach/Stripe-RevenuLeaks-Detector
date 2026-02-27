import { z } from 'zod'

/**
 * Extended validation schemas for API endpoints
 */

// Stripe connection validation
export const stripeConnectionSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
})

// Metrics query validation
export const metricsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  connectionId: z.string().uuid().optional(),
})

// Sync request validation
export const syncRequestSchema = z.object({
  stripeAccountId: z.string().min(1, 'Stripe account ID is required'),
  fullSync: z.boolean().default(false),
})

// Webhook event validation (basic structure check)
export const webhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.record(z.any()),
  }),
  created: z.number(),
  livemode: z.boolean(),
})

// User profile update validation
export const userProfileUpdateSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  email_notifications: z.boolean().optional(),
  sms_notifications: z.boolean().optional(),
  webhook_url: z.string().url().optional().or(z.literal('')),
  timezone: z.string().optional(),
})

// Pagination validation
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// Date range validation
export const dateRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine(
  (data) => data.endDate >= data.startDate,
  'End date must be after start date'
)

// Export validation
export const exportRequestSchema = z.object({
  format: z.enum(['csv', 'json', 'xlsx']),
  dateRange: dateRangeSchema.optional(),
  metrics: z.array(z.enum(['mrr', 'arr', 'churn', 'ltv', 'arpu'])).optional(),
})

// Sanitization utilities
export function sanitizeString(str: string): string {
  return str
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 1000) // Limit length
}

export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol')
    }
    return parsed.toString()
  } catch {
    throw new Error('Invalid URL')
  }
}

/**
 * Validate and sanitize input
 */
export function validateAndSanitize<T extends z.ZodType>(
  schema: T,
  data: unknown
): z.infer<T> {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      throw new Error(`Validation failed: ${messages}`)
    }
    throw error
  }
}

/**
 * Middleware helper for request validation
 */
export async function validateRequest<T extends z.ZodType>(
  req: Request,
  schema: T
): Promise<z.infer<T>> {
  const contentType = req.headers.get('content-type')

  let data: unknown

  if (contentType?.includes('application/json')) {
    data = await req.json()
  } else if (req.method === 'GET') {
    const url = new URL(req.url)
    data = Object.fromEntries(url.searchParams)
  } else {
    throw new Error('Unsupported content type')
  }

  return validateAndSanitize(schema, data)
}

// Type exports
export type MetricsQuery = z.infer<typeof metricsQuerySchema>
export type SyncRequest = z.infer<typeof syncRequestSchema>
export type UserProfileUpdate = z.infer<typeof userProfileUpdateSchema>
export type PaginationParams = z.infer<typeof paginationSchema>
export type DateRange = z.infer<typeof dateRangeSchema>
export type ExportRequest = z.infer<typeof exportRequestSchema>
