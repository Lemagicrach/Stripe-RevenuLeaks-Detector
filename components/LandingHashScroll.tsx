'use client'

import { useEffect } from 'react'

function scrollToHashTarget() {
  const hash = window.location.hash
  if (!hash) return

  const id = hash.startsWith('#') ? hash.slice(1) : hash
  if (!id) return

  const target = document.getElementById(id)
  if (!target) return

  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function LandingHashScroll() {
  useEffect(() => {
    const onHashChange = () => scrollToHashTarget()

    // Delay once so layout is fully painted before scrolling on first load.
    const timer = window.setTimeout(scrollToHashTarget, 0)
    window.addEventListener('hashchange', onHashChange)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [])

  return null
}
