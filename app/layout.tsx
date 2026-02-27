// app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import { Providers } from './providers'
import { Analytics } from '@vercel/analytics/react'
import { ErrorBoundary } from '@/components/error-boundary'
import { ChartProvider } from '@/components/chart-provider'
import { Toaster } from 'react-hot-toast'
import { TooltipProvider } from '@/components/ui/tooltip'
import FeedbackButton from '@/components/FeedbackButton'
import { FeedbackProvider } from '@/hooks/use-feedback'
import FeedbackModal from '@/components/FeedbackModal'

export const metadata: Metadata = {
  title: 'Revenue Insights & Leak Alerts for Stripe SaaS | RevPilot',
  description:
    "Stop guessing what’s hurting your MRR. RevPilot analyzes your Stripe data and alerts you to churn spikes, failed payments, and growth risks — in minutes. Free under $10K MRR. 5-minute setup. No credit card required.",
  keywords:
    'revpilot, revenue leak alerts, stripe leak alerts, stripe analytics, baremetrics alternative, mrr tracking, churn analysis, saas metrics, ai insights',
  authors: [{ name: 'RevPilot Team' }],
  openGraph: {
    title: 'Revenue Insights & Leak Alerts for Stripe SaaS',
    description: 'Turn your Stripe data into actionable revenue leak alerts and insights. Track MRR, churn, and growth in minutes. Free under $10K MRR.',
    url: 'https://revpilot.dev',
    siteName: 'RevPilot',
    images: [
      {
        url: 'https://revpilot-net.vercel.app/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <FeedbackProvider>
          <ErrorBoundary>
            <Providers>
              <TooltipProvider>
                <ChartProvider>{children}</ChartProvider>
              </TooltipProvider>
              <Toaster />
            </Providers>
            <FeedbackButton />
            <FeedbackModal />
            <Analytics />
          </ErrorBoundary>
        </FeedbackProvider>
      </body>
    </html>
  )
}
