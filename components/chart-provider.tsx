'use client'

import { useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

/**
 * Chart.js Provider Component
 * 
 * This component registers all Chart.js components globally.
 * It must be a client component because Chart.js runs in the browser.
 * 
 * Usage: Wrap your app with this component in the root layout.
 */
export function ChartProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Register Chart.js components
    ChartJS.register(
      CategoryScale,
      LinearScale,
      PointElement,
      LineElement,
      BarElement,
      ArcElement,
      Title,
      Tooltip,
      Legend,
      Filler
    )
  }, [])

  return <>{children}</>
}
