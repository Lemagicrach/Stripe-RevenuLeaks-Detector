import { NextResponse } from 'next/server'

// Utility for generating unique error codes and logging stack traces.

/**
 * Generates a unique error code using a prefix, timestamp, and random suffix.
 * Logs the error and its stack trace to the server console with the code for tracing.
 * Returns a standardized error response object that can be returned to the client.
 *
 * @param error The caught error object.
 * @param codePrefix A short prefix identifying the route or module where the error occurred.
 */
export function handleApiError(error: unknown, codePrefix = 'api') {
  // Generate a timestamp-based identifier and a random suffix for uniqueness
  const timestamp = Date.now().toString(36)
  const random = Math.floor(Math.random() * 1e6).toString(36)
  const errorCode = `${codePrefix}_${timestamp}${random}`
  // Log full error details server-side (stack trace included if available)
  console.error(`[${errorCode}]`, error)
  if (
    error &&
    typeof error === 'object' &&
    'stack' in error &&
    typeof (error as { stack?: unknown }).stack === 'string'
  ) {
    console.error(`[${errorCode}] stack:`, (error as { stack: string }).stack)
  }
  // Return minimal information to client with the error code.
  return NextResponse.json(
    {
      success: false,
      error: {
        code: errorCode,
        message:
          'An unexpected error occurred. Please retry or contact support with the provided error code.',
      },
    },
    { status: 500 }
  )
}
