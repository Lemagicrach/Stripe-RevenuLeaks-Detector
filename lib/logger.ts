/**
 * Centralized logging utility for production-ready error tracking
 * Integrates with Sentry and provides structured logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  userId?: string
  requestId?: string
  endpoint?: string
  duration?: number
  [key: string]: any
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
  }

  debug(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, context))
    }
  }

  info(message: string, context?: LogContext) {
    console.info(this.formatMessage('info', message, context))
  }

  warn(message: string, context?: LogContext) {
    console.warn(this.formatMessage('warn', message, context))

    // Send to Sentry as breadcrumb in production
    if (!this.isDevelopment && typeof window !== 'undefined') {
      // Sentry will be initialized in sentry.client.config.ts
      // @ts-ignore
      if (window.Sentry) {
        // @ts-ignore
        window.Sentry.addBreadcrumb({
          message,
          level: 'warning',
          data: context,
        })
      }
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext) {
    console.error(this.formatMessage('error', message, context), error)

    // Send to Sentry in production
    if (!this.isDevelopment) {
      try {
        // Server-side
        if (typeof window === 'undefined') {
          // Will be set up in sentry.server.config.ts
          const Sentry = require('@sentry/nextjs')
          Sentry.captureException(error || new Error(message), {
            tags: {
              endpoint: context?.endpoint,
            },
            extra: context,
          })
        }
        // Client-side
        else {
          // @ts-ignore
          if (window.Sentry) {
            // @ts-ignore
            window.Sentry.captureException(error || new Error(message), {
              tags: {
                page: context?.endpoint,
              },
              extra: context,
            })
          }
        }
      } catch (sentryError) {
        console.error('Failed to send error to Sentry:', sentryError)
      }
    }
  }

  /**
   * Log API request with timing
   */
  async logApiRequest<T>(
    endpoint: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const startTime = Date.now()

    try {
      const result = await fn()
      const duration = Date.now() - startTime

      this.info(`API Request: ${endpoint}`, {
        ...context,
        endpoint,
        duration,
        status: 'success',
      })

      return result
    } catch (error) {
      const duration = Date.now() - startTime

      this.error(`API Request Failed: ${endpoint}`, error, {
        ...context,
        endpoint,
        duration,
        status: 'error',
      })

      throw error
    }
  }

  /**
   * Log database query with timing
   */
  async logDbQuery<T>(
    queryName: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const startTime = Date.now()

    try {
      const result = await fn()
      const duration = Date.now() - startTime

      if (duration > 1000) {
        this.warn(`Slow database query: ${queryName}`, {
          ...context,
          queryName,
          duration,
        })
      } else if (this.isDevelopment) {
        this.debug(`Database query: ${queryName}`, {
          ...context,
          queryName,
          duration,
        })
      }

      return result
    } catch (error) {
      const duration = Date.now() - startTime

      this.error(`Database query failed: ${queryName}`, error, {
        ...context,
        queryName,
        duration,
      })

      throw error
    }
  }
}

// Export singleton instance
export const logger = new Logger()

// Export types
export type { LogLevel, LogContext }
