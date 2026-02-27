'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

type FeedbackContextType = {
  isFeedbackOpen: boolean
  openFeedback: () => void
  closeFeedback: () => void
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined)

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)

  const openFeedback = () => setIsFeedbackOpen(true)
  const closeFeedback = () => setIsFeedbackOpen(false)

  return (
    <FeedbackContext.Provider value={{ isFeedbackOpen, openFeedback, closeFeedback }}>
      {children}
    </FeedbackContext.Provider>
  )
}

export function useFeedback() {
  const context = useContext(FeedbackContext)
  if (context === undefined) {
    throw new Error('useFeedback must be used within a FeedbackProvider')
  }
  return context
}
