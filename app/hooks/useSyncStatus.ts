// hooks/useSyncStatus.ts
'use client'

import { useState, useEffect, useCallback } from 'react'

// Utilisez la variable publique si elle est définie, sinon la méthode par défaut
const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');


export enum SyncStage {
  IDLE = 'IDLE',
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface SyncStatus {
  stage: SyncStage
  message: string
  progress: number
  isSyncing: boolean
}

const initialState: SyncStatus = {
  stage: SyncStage.IDLE,
  message: 'Idle. Ready to sync.',
  progress: 0,
  isSyncing: false,
}

export const useSyncStatus = (accountId: string | undefined) => {
  const [status, setStatus] = useState<SyncStatus>(initialState)

  const fetchSyncStatus = useCallback(async () => {
    if (!accountId) return SyncStage.IDLE

    try {
      const response = await fetch(`${API_BASE_URL}/api/stripe/sync-status?accountId=${accountId}`)
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setStatus(s => ({
            ...s,
            stage: SyncStage.FAILED,
            message: 'Not authorized to view sync status.',
            isSyncing: false,
          }))
          return SyncStage.FAILED
        }
        throw new Error(`Failed to fetch sync status from API (status ${response.status})`)
      }

      const contentType = response.headers.get('content-type') || ''
      const raw = await response.text()
      if (!contentType.includes('application/json')) {
        throw new Error(`Unexpected response format from sync status API: ${raw.slice(0, 100)}`)
      }

      const data: { stage?: SyncStage; message?: string; progress?: number } = JSON.parse(raw)
      const stage = data.stage ?? SyncStage.IDLE
      const message = data.message ?? 'Waiting to start sync.'
      const progress = data.progress ?? 0

      setStatus({
        stage,
        message,
        progress,
        isSyncing: stage === SyncStage.PENDING || stage === SyncStage.IN_PROGRESS,
      })

      return stage
    } catch (error) {
      console.error('Polling error:', error)
      setStatus(s => ({
        ...s,
        stage: SyncStage.FAILED,
        message: error instanceof Error ? error.message : 'Unknown error during sync.',
        isSyncing: false,
      }))
      return SyncStage.FAILED
    }
  }, [accountId])

  const triggerSync = useCallback(
    async (force = true) => {
      if (!accountId) {
        console.error('Cannot trigger sync: accountId is missing.')
        return
      }

      setStatus({
        stage: SyncStage.PENDING,
        message: 'Starting synchronization...',
        progress: 0,
        isSyncing: true,
      })

      try {
        const response = await fetch(`${API_BASE_URL}/api/stripe/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stripeAccountId: accountId, force }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || 'Failed to start sync process on the server.')
        }
      } catch (error) {
        console.error('Trigger sync error:', error)
        setStatus(s => ({
          ...s,
          stage: SyncStage.FAILED,
          message: error instanceof Error ? error.message : 'Failed to communicate with sync server.',
          isSyncing: false,
        }))
      }
    },
    [accountId]
  )

  useEffect(() => {
    if (!accountId) {
      setStatus(initialState)
      return
    }

    let intervalId: NodeJS.Timeout | null = null

    const startPolling = () => {
      if (intervalId) clearInterval(intervalId)

      intervalId = setInterval(async () => {
        const currentStage = await fetchSyncStatus()
        if (currentStage === SyncStage.COMPLETED || currentStage === SyncStage.FAILED || currentStage === SyncStage.IDLE) {
          if (intervalId) {
            clearInterval(intervalId)
            intervalId = null
          }
        }
      }, 3000)
    }

    const shouldStartPolling = status.stage === SyncStage.PENDING || status.stage === SyncStage.IN_PROGRESS || status.isSyncing
    if (shouldStartPolling) {
      startPolling()
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [accountId, status.stage, status.isSyncing, fetchSyncStatus])

  useEffect(() => {
    fetchSyncStatus()
  }, [fetchSyncStatus])

  return { status, triggerSync }
}
