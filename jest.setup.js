// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_KEY = 'test-service-key'
process.env.STRIPE_SECRET_KEY = 'sk_test_123'
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

// Mock fetch globally
global.fetch = jest.fn()

// Polyfill Response/Headers for node/jsdom environments that don't provide them
if (typeof Response === 'undefined') {
  class MockHeaders {
    constructor(headers = {}) {
      this.map = new Map(
        Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
      )
    }
    get(key) {
      return this.map.get(key.toLowerCase()) || null
    }
    set(key, value) {
      this.map.set(key.toLowerCase(), value)
    }
  }

  class MockResponse {
    constructor(body = '', init = {}) {
      this.body = body
      this.status = init.status || 200
      this.statusText = init.statusText || ''
      this.headers = new MockHeaders(init.headers || {})
      this.ok = this.status >= 200 && this.status < 300
    }
    async json() {
      return this.body ? JSON.parse(this.body) : {}
    }
    async text() {
      return this.body?.toString() ?? ''
    }
  }

  global.Response = MockResponse
  global.Headers = MockHeaders
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})
