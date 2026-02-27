'use client'

import { useEffect, useState } from 'react'

interface SocialProofBannerProps {
  initialFounders?: number
  initialMrr?: number
}

export function SocialProofBanner({ initialFounders = 347, initialMrr = 2.4 }: SocialProofBannerProps) {
  const [founders, setFounders] = useState(initialFounders)
  const [mrr, setMrr] = useState(initialMrr)

  useEffect(() => {
    const interval = setInterval(() => {
      setFounders(prev => prev + Math.floor(Math.random() * 3) + 1)
      setMrr(prev => parseFloat((prev + Math.random() * 0.05).toFixed(2)))
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="social-proof-banner w-full rounded-2xl border border-indigo-100 bg-white/80 shadow-sm px-4 py-3 flex flex-col sm:flex-row items-center justify-center gap-2 text-sm sm:text-base text-gray-700">
      <span className="text-lg sm:text-xl">🚀</span>
      <span className="user-count">
        Join <strong>{founders} founders</strong> tracking <strong>${mrr.toFixed(1)}M</strong> in MRR
      </span>
    </div>
  )
}
