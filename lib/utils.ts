// lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility to merge Tailwind classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Validate URL
 */
export function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return ['http:', 'https:'].includes(urlObj.protocol)
  } catch {
    return false
  }
}

/**
 * Validate email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Format currency
 */
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format number with abbreviation (1K, 1M, etc)
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Calculate percentage change
 */
export function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return 0
  return ((newValue - oldValue) / oldValue) * 100
}

/**
 * Calculate savings
 */
export function calculateSavings(originalPrice: number, currentPrice: number): number {
  return Math.max(0, originalPrice - currentPrice)
}

/**
 * Calculate discount percentage
 */
export function calculateDiscountPercentage(originalPrice: number, currentPrice: number): number {
  if (originalPrice === 0) return 0
  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const then = typeof date === 'string' ? new Date(date) : date
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)

  const intervals: { [key: string]: number } = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1,
  }

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit)
    if (interval >= 1) {
      return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`
    }
  }

  return 'just now'
}

/**
 * Format date - FIXED VERSION
 */
export function formatDate(date: Date | string, format: 'short' | 'long' | 'full' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date

  // Define options map with proper typing
  const optionsMap: Record<'short' | 'long' | 'full', Intl.DateTimeFormatOptions> = {
    short: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { month: 'long', day: 'numeric', year: 'numeric' },
    full: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
  }

  const options = optionsMap[format]

  return new Intl.DateTimeFormat('en-US', options).format(d)
}

/**
 * Truncate text
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return text.substring(0, length) + '...'
}

/**
 * Slugify string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-')
}

/**
 * Generate random string
 */
export function generateRandomString(length: number = 10): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * Sleep/delay function
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number
    delay?: number
    backoff?: number
  } = {}
): Promise<T> {
  const { retries = 3, delay = 1000, backoff = 2 } = options

  try {
    return await fn()
  } catch (error) {
    if (retries <= 0) throw error

    await sleep(delay)
    return retry(fn, {
      retries: retries - 1,
      delay: delay * backoff,
      backoff,
    })
  }
}

/**
 * Safe JSON parse
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json)
  } catch {
    return fallback
  }
}

/**
 * Group array by key
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key])
    if (!result[groupKey]) {
      result[groupKey] = []
    }
    result[groupKey].push(item)
    return result
  }, {} as Record<string, T[]>)
}

/**
 * Remove duplicates from array
 */
export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array))
}

/**
 * Sort array by key
 */
export function sortBy<T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key]
    const bVal = b[key]

    if (aVal < bVal) return order === 'asc' ? -1 : 1
    if (aVal > bVal) return order === 'asc' ? 1 : -1
    return 0
  })
}

/**
 * Parse price from string
 */
export function parsePrice(priceString: string): number {
  const cleaned = priceString.replace(/[$£€¥,\s]/g, '').replace(/[^\d.]/g, '')
  const price = parseFloat(cleaned)
  return isNaN(price) ? 0 : price
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace('www.', '')
  } catch {
    return ''
  }
}

/**
 * Check if price is a good deal
 */
export function isGoodDeal(currentPrice: number, historicalPrices: number[]): boolean {
  if (historicalPrices.length === 0) return false

  const avgPrice = historicalPrices.reduce((a, b) => a + b, 0) / historicalPrices.length
  const minPrice = Math.min(...historicalPrices)

  // It's a good deal if current price is <= 10% above historical minimum
  // OR <= 20% below average
  return currentPrice <= minPrice * 1.1 || currentPrice <= avgPrice * 0.8
}

/**
 * Calculate trend (up, down, stable)
 */
export function calculateTrend(prices: number[]): 'up' | 'down' | 'stable' {
  if (prices.length < 2) return 'stable'

  const recentPrices = prices.slice(-5) // Last 5 prices
  const avgRecent = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length
  const avgOlder = prices.slice(0, -5).reduce((a, b) => a + b, 0) / (prices.length - 5)

  const changePercent = ((avgRecent - avgOlder) / avgOlder) * 100

  if (changePercent > 5) return 'up'
  if (changePercent < -5) return 'down'
  return 'stable'
}

/**
 * Color for price change
 */
export function getPriceChangeColor(change: number): string {
  if (change < 0) return 'text-green-600' // Price dropped
  if (change > 0) return 'text-red-600' // Price increased
  return 'text-gray-600' // No change
}

/**
 * Sanitize HTML (basic - use DOMPurify for production)
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
}

/**
 * Copy to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Download file
 */
export function downloadFile(content: string, filename: string, type: string = 'text/plain') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Share via Web Share API
 */
export async function share(data: { title?: string; text?: string; url?: string }): Promise<boolean> {
  if (!navigator.share) return false

  try {
    await navigator.share(data)
    return true
  } catch {
    return false
  }
}

/**
 * Environment helpers
 */
export const isDevelopment = process.env.NODE_ENV === 'development'
export const isProduction = process.env.NODE_ENV === 'production'
export const isServer = typeof window === 'undefined'
export const isClient = !isServer


/**
 * Log error (can be extended to send to monitoring service)
 */
export function logError(message: string, error: any, context?: Record<string, any>) {
  console.error(`[ERROR] ${message}:`, error, context)
  
  // TODO: Send to error monitoring service (Sentry, etc.)
  // if (isProduction) {
  //   Sentry.captureException(error, { extra: { message, ...context } })
  // }
}