import Stripe from 'stripe'

/**
 * ✅ FIX #3: Robust Stripe API wrapper with retry logic
 * 
 * Handles:
 * - Rate limiting (429 errors)
 * - Network timeouts
 * - Transient failures
 * - Exponential backoff
 */

export interface RetryOptions {
  maxRetries?: number
  baseDelay?: number // milliseconds
  maxDelay?: number // milliseconds
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
}

/**
 * Execute Stripe API call with automatic retry on rate limits
 */
export async function stripeWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError: Error | undefined
  
  for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      // Only retry on specific errors
      const shouldRetry = 
        error instanceof Stripe.errors.StripeRateLimitError ||
        error instanceof Stripe.errors.StripeConnectionError ||
        error instanceof Stripe.errors.StripeAPIError
      
      if (!shouldRetry || attempt === opts.maxRetries - 1) {
        break
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.baseDelay * Math.pow(2, attempt),
        opts.maxDelay
      )
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.3 * delay
      const totalDelay = delay + jitter
      
      console.warn(
        `Stripe API retry ${attempt + 1}/${opts.maxRetries} after ${Math.round(totalDelay)}ms`,
        { error: (error as Error).message }
      )
      
      await new Promise(resolve => setTimeout(resolve, totalDelay))
    }
  }
  
  // All retries exhausted
  console.error('Stripe API call failed after retries:', lastError)
  throw lastError
}

/**
 * Safe wrapper for listing Stripe resources with pagination
 * Prevents infinite loops and handles rate limits
 */
export async function listAllStripeResources<T extends { id: string }>(
  listFn: (params: { starting_after?: string; limit: number }) => Promise<Stripe.ApiList<T>>,
  maxPages = 100
): Promise<T[]> {
  const allItems: T[] = []
  let hasMore = true
  let startingAfter: string | undefined
  let pageCount = 0
  
  while (hasMore && pageCount < maxPages) {
    try {
      const page = await stripeWithRetry(() =>
        listFn({
          starting_after: startingAfter,
          limit: 100,
        })
      )
      
      allItems.push(...page.data)
      hasMore = page.has_more
      
      if (hasMore && page.data.length > 0) {
        startingAfter = page.data[page.data.length - 1].id
      }
      
      pageCount++
      
      if (pageCount >= maxPages) {
        console.warn(
          `Reached max pages (${maxPages}) when fetching Stripe resources. ` +
          `Total items: ${allItems.length}`
        )
      }
    } catch (error) {
      console.error('Failed to fetch Stripe resources:', error)
      throw error
    }
  }
  
  return allItems
}

/**
 * Helper class for common Stripe operations with error handling
 */
export class SafeStripeClient {
  constructor(private stripe: Stripe) {}
  
  /**
   * List all subscriptions with automatic pagination and retry
   */
  async listAllSubscriptions(
    params: Stripe.SubscriptionListParams = {}
  ): Promise<Stripe.Subscription[]> {
    return listAllStripeResources(
      (paginationParams) =>
        this.stripe.subscriptions.list({
          ...params,
          ...paginationParams,
        })
    )
  }
  
  /**
   * List all customers with automatic pagination and retry
   */
  async listAllCustomers(
    params: Stripe.CustomerListParams = {}
  ): Promise<Stripe.Customer[]> {
    return listAllStripeResources(
      (paginationParams) =>
        this.stripe.customers.list({
          ...params,
          ...paginationParams,
        })
    )
  }

  /**
   * List ALL invoices across pagination with retry protection.
   * Useful for caching invoices into Supabase for leak detection (failed payments, recovery gap).
   */
  async listAllInvoices(params: Stripe.InvoiceListParams = {}): Promise<Stripe.Invoice[]> {
    const all: Stripe.Invoice[] = []
    let startingAfter: string | undefined = undefined

    while (true) {
      const page = await stripeWithRetry(() =>
        this.stripe.invoices.list({
          limit: 100,
          ...params,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        })
      )

      all.push(...page.data)

      if (!page.has_more) break
      startingAfter = page.data[page.data.length - 1]?.id
      if (!startingAfter) break
    }

    return all
  }

  
  /**
   * Retrieve subscription with retry
   */
  async getSubscription(id: string): Promise<Stripe.Subscription> {
    return stripeWithRetry(() =>
      this.stripe.subscriptions.retrieve(id)
    )
  }
  
  /**
   * Retrieve customer with retry
   */
  async getCustomer(id: string): Promise<Stripe.Customer> {
    const response = await stripeWithRetry(() =>
      this.stripe.customers.retrieve(id)
    );
    // Check if the customer is deleted
    if ((response as Stripe.DeletedCustomer).deleted) {
      throw new Error(`Customer with id ${id} is deleted.`);
    }
    return response as Stripe.Customer;
  }
}