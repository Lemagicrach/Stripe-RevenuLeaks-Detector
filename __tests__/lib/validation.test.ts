import { describe, it, expect } from '@jest/globals'
import {
  trackProductSchema,
  updateProfileSchema,
  addProductSchema,
  priceAlertSchema,
} from '@/lib/validation'

describe('Validation Schemas', () => {
  describe('trackProductSchema', () => {
    it('should validate a valid product URL', () => {
      const data = {
        url: 'https://example.com/product',
        target_price: 99.99,
        notify_on_drop: true,
      }

      const result = trackProductSchema.parse(data)
      expect(result).toEqual(data)
    })

    it('should reject invalid URL', () => {
      const data = {
        url: 'not-a-url',
        target_price: 99.99,
      }

      expect(() => trackProductSchema.parse(data)).toThrow()
    })

    it('should reject negative price', () => {
      const data = {
        url: 'https://example.com/product',
        target_price: -10,
      }

      expect(() => trackProductSchema.parse(data)).toThrow()
    })

    it('should use default notify_on_drop', () => {
      const data = {
        url: 'https://example.com/product',
      }

      const result = trackProductSchema.parse(data)
      expect(result.notify_on_drop).toBe(true)
    })
  })

  describe('updateProfileSchema', () => {
    it('should validate valid profile update', () => {
      const data = {
        full_name: 'John Doe',
        email: 'john@example.com',
      }

      const result = updateProfileSchema.parse(data)
      expect(result.full_name).toBe('John Doe')
    })

    it('should reject short names', () => {
      const data = {
        full_name: 'J',
      }

      expect(() => updateProfileSchema.parse(data)).toThrow()
    })

    it('should reject invalid email', () => {
      const data = {
        full_name: 'John Doe',
        email: 'invalid-email',
      }

      expect(() => updateProfileSchema.parse(data)).toThrow()
    })
  })

  describe('addProductSchema', () => {
    it('should validate complete product data', () => {
      const data = {
        url: 'https://example.com/product',
        name: 'Test Product',
        target_price: 50,
        current_price: 100,
        notify_on_drop: true,
      }

      const result = addProductSchema.parse(data)
      expect(result).toEqual(data)
    })

    it('should reject missing required fields', () => {
      const data = {
        url: 'https://example.com/product',
      }

      expect(() => addProductSchema.parse(data)).toThrow()
    })
  })

  describe('priceAlertSchema', () => {
    it('should validate percentage threshold', () => {
      const data = {
        product_id: 'prod_123',
        threshold_type: 'percentage' as const,
        threshold_value: 10,
        is_active: true,
      }

      const result = priceAlertSchema.parse(data)
      expect(result.threshold_type).toBe('percentage')
    })

    it('should validate fixed threshold', () => {
      const data = {
        product_id: 'prod_123',
        threshold_type: 'fixed' as const,
        threshold_value: 50,
      }

      const result = priceAlertSchema.parse(data)
      expect(result.is_active).toBe(true) // default value
    })
  })
})
