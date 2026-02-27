// components/SyncProgress.tsx
'use client'

import { Loader2, Zap, AlertCircle } from 'lucide-react'
import { useSyncStatus, SyncStage } from '@/hooks/useSyncStatus'

interface SyncProgressProps {
  accountId: string
}

const steps = [
  { stage: SyncStage.PENDING, message: 'Initiation...', progress: 10 },
  { stage: SyncStage.IN_PROGRESS, message: 'Fetching metadata', progress: 30 },
  { stage: SyncStage.IN_PROGRESS, message: 'Processing subscriptions', progress: 60 },
  { stage: SyncStage.IN_PROGRESS, message: 'Calculating metrics', progress: 90 },
  { stage: SyncStage.COMPLETED, message: 'Complete!', progress: 100 },
]

export const SyncProgress = ({ accountId }: SyncProgressProps) => {
  const { status } = useSyncStatus(accountId)

  const currentStep =
    steps.find(step => step.stage === status.stage) || {
      stage: status.stage,
      message: status.stage === SyncStage.FAILED ? 'Synchronization failed.' : status.message,
      progress: status.progress,
    }

  const isFinished = status.stage === SyncStage.COMPLETED
  const isFailed = status.stage === SyncStage.FAILED

  const progressValue = status.progress > 0 ? status.progress : currentStep.progress

  let colorClass = 'bg-indigo-600'
  if (isFinished) {
    colorClass = 'bg-green-500'
  } else if (isFailed) {
    colorClass = 'bg-red-500'
  }

  return (
    <div className="max-w-xl w-full bg-white p-8 rounded-xl shadow-2xl border border-gray-100">
      <div className="text-center mb-6">
        {isFailed ? (
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        ) : isFinished ? (
          <Zap className="w-12 h-12 text-green-500 mx-auto mb-3" />
        ) : (
          <Loader2 className="w-12 h-12 text-indigo-600 mx-auto mb-3 animate-spin" />
        )}

        <h2 className="text-2xl font-bold text-gray-900">
          {isFinished ? 'Data Sync Complete!' : isFailed ? 'Sync Failed' : 'Data Synchronization in Progress'}
        </h2>
        <p className="text-gray-600 mt-1">{currentStep.message}</p>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
        <div
          className={`h-2.5 rounded-full ${colorClass} transition-all duration-500 ease-in-out`}
          style={{ width: `${progressValue}%` }} // inline for dynamic width
        ></div>
      </div>

      <div className="flex justify-between text-sm text-gray-500">
        <span>Current Progress</span>
        <span className="font-semibold text-gray-800">{progressValue}%</span>
      </div>

      {isFailed && (
        <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          **Error:** {status.message}
        </div>
      )}
    </div>
  )
}
