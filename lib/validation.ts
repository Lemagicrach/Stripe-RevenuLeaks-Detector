import { z } from 'zod'

// Product tracking schema
export const trackProductSchema = z.object({
  url: z.string().url({ message: 'A valid product URL is required' }),
  target_price: z.number().positive().optional(),
  notify_on_drop: z.boolean().optional().default(true),
})

// Profile update schema
export const updateProfileSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address').optional(),
})

// Product creation schema
export const addProductSchema = z.object({
  url: z.string().url({ message: 'A valid product URL is required' }),
  name: z.string().min(1, 'Product name is required'),
  target_price: z.number().positive('Target price must be positive'),
  current_price: z.number().positive('Current price must be positive'),
  notify_on_drop: z.boolean().optional().default(true),
})

// Price alert schema
export const priceAlertSchema = z.object({
  product_id: z.string().min(1, 'Product ID is required'),
  threshold_type: z.enum(['percentage', 'fixed']),
  threshold_value: z.number().positive('Threshold must be positive'),
  is_active: z.boolean().optional().default(true),
})

export type TrackProductInput = z.infer<typeof trackProductSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type AddProductInput = z.infer<typeof addProductSchema>
export type PriceAlertInput = z.infer<typeof priceAlertSchema>
