'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

type DialogContextValue = {
  onOpenChange?: (open?: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue | undefined>(undefined)

function useDialogContext() {
  const ctx = React.useContext(DialogContext)
  if (!ctx) {
    throw new Error('Dialog components must be used within a Dialog')
  }
  return ctx
}

type DialogProps = {
  open?: boolean
  onOpenChange?: (open?: boolean) => void
  children: React.ReactNode
}

export function Dialog({ open = false, onOpenChange, children }: DialogProps) {
  if (!open) return null

  return (
    <DialogContext.Provider value={{ onOpenChange }}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={() => onOpenChange?.(false)}
      >
        <div className="w-full max-w-lg px-4" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </DialogContext.Provider>
  )
}

type DialogContentProps = {
  children: React.ReactNode
  className?: string
}

export function DialogContent({ children, className }: DialogContentProps) {
  return (
    <div className={cn('rounded-lg bg-white p-6 shadow-xl', className)}>
      {children}
    </div>
  )
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 space-y-1">{children}</div>
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-gray-900">{children}</h2>
}

export function DialogDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-600">{children}</p>
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  useDialogContext()
  return <div className="mt-6 flex items-center justify-end space-x-2">{children}</div>
}
