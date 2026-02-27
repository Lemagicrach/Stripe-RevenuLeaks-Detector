import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { fetchWithRetry, ApiClient } from '@/lib/api-client'

describe('API Client', () => {
  let fetchMock: jest.MockedFunction<typeof fetch>
  const originalWarn = console.warn

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>
    fetchMock = global.fetch as jest.MockedFunction<typeof fetch>
    console.warn = jest.fn()
  })

  afterEach(() => {
    console.warn = originalWarn
  })

  describe('fetchWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockResponse = new Response('{"data": "success"}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })

      fetchMock.mockResolvedValueOnce(mockResponse)

      const response = await fetchWithRetry('https://api.example.com/test')

      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(response.ok).toBe(true)
    })

    it('should retry on 500 error', async () => {
      const errorResponse = new Response('Internal Server Error', { status: 500 })
      const successResponse = new Response('{"data": "success"}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })

      fetchMock.mockResolvedValueOnce(errorResponse).mockResolvedValueOnce(successResponse)

      const response = await fetchWithRetry(
        'https://api.example.com/test',
        {},
        { maxRetries: 3, initialDelay: 100 }
      )

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(response.ok).toBe(true)
    })

    it('should not retry on 404 error', async () => {
      const errorResponse = new Response('Not Found', { status: 404 })

      fetchMock.mockResolvedValueOnce(errorResponse)

      const response = await fetchWithRetry('https://api.example.com/test')

      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(response.status).toBe(404)
    })
  })

  describe('ApiClient', () => {
    it('should make GET request', async () => {
      const client = new ApiClient('https://api.example.com')
      const mockResponse = new Response('{"data": "success"}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })

      fetchMock.mockResolvedValueOnce(mockResponse)

      const result = await client.get('/test')

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'GET',
        })
      )
      expect(result).toEqual({ data: 'success' })
    })

    it('should make POST request with body', async () => {
      const client = new ApiClient('https://api.example.com')
      const mockResponse = new Response('{"data": "created"}', {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })

      fetchMock.mockResolvedValueOnce(mockResponse)

      const body = { name: 'test' }
      const result = await client.post('/test', body)

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body),
        })
      )
      expect(result).toEqual({ data: 'created' })
    })
  })
})
