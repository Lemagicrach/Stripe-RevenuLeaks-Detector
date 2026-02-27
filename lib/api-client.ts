/**
 * Robust API client with retry logic, timeout handling, and error recovery
 */

import { logger } from './logger'

interface RetryOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  retryableStatuses?: number[]
  timeout?: number
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  timeout: 30000, // 30 seconds
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate exponential backoff delay
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number
): number {
  const delay = Math.min(initialDelay * Math.pow(multiplier, attempt), maxDelay)
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000
}

/**
 * Check if error is retryable
 */
function isRetryable(error: any, retryableStatuses: number[]): boolean {
  // Network errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return true
  }

  // Timeout errors
  if (error.name === 'AbortError') {
    return true
  }

  // HTTP status codes
  if (error.response?.status) {
    return retryableStatuses.includes(error.response.status)
  }

  return false
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * Fetch with retry logic
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions }
  let lastError: any

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      logger.debug(`API request attempt ${attempt + 1}/${opts.maxRetries + 1}`, {
        url,
        method: options.method || 'GET',
      })

      const response = await fetchWithTimeout(url, options, opts.timeout)

      // If response is successful, return it
      if (response.ok) {
        return response
      }

      // Check if we should retry based on status code
      if (!opts.retryableStatuses.includes(response.status)) {
        return response // Don't retry, return error response
      }

      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
      lastError.response = response

      // Handle rate limiting with Retry-After header
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After')
        if (retryAfter) {
          const delay = parseInt(retryAfter) * 1000
          logger.warn('Rate limited, waiting before retry', { delay, url })
          await sleep(delay)
          continue
        }
      }
    } catch (error: any) {
      lastError = error

      if (!isRetryable(error, opts.retryableStatuses)) {
        logger.error('Non-retryable error', error, { url, attempt })
        throw error
      }
    }

    // Don't sleep after the last attempt
    if (attempt < opts.maxRetries) {
      const delay = calculateDelay(
        attempt,
        opts.initialDelay,
        opts.maxDelay,
        opts.backoffMultiplier
      )
      logger.warn('Request failed, retrying', {
        attempt: attempt + 1,
        maxRetries: opts.maxRetries,
        delay,
        url,
      })
      await sleep(delay)
    }
  }

  logger.error('All retry attempts exhausted', lastError, { url })
  throw lastError
}

/**
 * Type-safe API client wrapper
 */
export class ApiClient {
  private baseUrl: string
  private defaultHeaders: HeadersInit

  constructor(baseUrl: string = '', defaultHeaders: HeadersInit = {}) {
    this.baseUrl = baseUrl
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryOptions?: RetryOptions
  ): Promise<T> {
    const url = this.baseUrl + endpoint
    const mergedOptions: RequestInit = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
    }

    const response = await fetchWithRetry(url, mergedOptions, retryOptions)

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
      ;(error as any).response = response
      throw error
    }

    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      return response.json()
    }

    return response.text() as any
  }

  async get<T>(
    endpoint: string,
    options?: RequestInit,
    retryOptions?: RetryOptions
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' }, retryOptions)
  }

  async post<T>(
    endpoint: string,
    body?: any,
    options?: RequestInit,
    retryOptions?: RetryOptions
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        ...options,
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      },
      retryOptions
    )
  }

  async put<T>(
    endpoint: string,
    body?: any,
    options?: RequestInit,
    retryOptions?: RetryOptions
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        ...options,
        method: 'PUT',
        body: body ? JSON.stringify(body) : undefined,
      },
      retryOptions
    )
  }

  async delete<T>(
    endpoint: string,
    options?: RequestInit,
    retryOptions?: RetryOptions
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' }, retryOptions)
  }

  async patch<T>(
    endpoint: string,
    body?: any,
    options?: RequestInit,
    retryOptions?: RetryOptions
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        ...options,
        method: 'PATCH',
        body: body ? JSON.stringify(body) : undefined,
      },
      retryOptions
    )
  }
}

// Export singleton instances
export const apiClient = new ApiClient()
export const stripeApiClient = new ApiClient('https://api.stripe.com')
