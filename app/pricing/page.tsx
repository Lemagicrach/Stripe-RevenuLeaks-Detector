'use client';

import { Suspense, useState } from 'react';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { pricingTiers, PricingTier } from '@/lib/pricing-tiers';
import { PricingCards } from '@/components/PricingCards';
import { buildConnectUrl, sanitizePlanId } from '@/lib/plan-flow';

function PricingPageContent() {
  const [monthlyVolume, setMonthlyVolume] = useState(50000);
  const [aiInsights, setAiInsights] = useState(25);
  const searchParams = useSearchParams();
  const selectedPlan = sanitizePlanId(searchParams?.get('plan'));
  const selectedTier = selectedPlan
    ? pricingTiers.find((tier) => tier.planId === selectedPlan)
    : null;

  const calculatePrice = (tier: PricingTier) => {
    let total = tier.price;

    if (monthlyVolume > tier.includedVolume && tier.overageRatePer10k > 0) {
      const overage = monthlyVolume - tier.includedVolume;
      const overageUnits = Math.ceil(overage / 10000);
      total += overageUnits * tier.overageRatePer10k;
    }

    if (aiInsights > tier.includedInsights && tier.overageRatePerInsight > 0) {
      const overage = aiInsights - tier.includedInsights;
      total += overage * tier.overageRatePerInsight;
    }

    return total;
  };

  const formatVolume = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-4">
            Pricing That Grows With You
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Usage-based pricing that's fair and transparent. Pay only for what you use.
          </p>
        </div>

        {selectedPlan && (
          <div className="max-w-4xl mx-auto mb-8 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-5">
            <p className="text-emerald-200 text-sm md:text-base">
              {`Selected plan: ${selectedTier?.displayName || selectedPlan}.`}
              {' '}We connect Stripe first, run your leak scan, then you can start your trial from the leaks dashboard.
            </p>
            <div className="mt-4">
              <Link
                href={buildConnectUrl(selectedPlan)}
                className="inline-flex items-center rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-white transition hover:bg-emerald-600"
              >
                Continue with {selectedTier?.displayName || selectedPlan}
              </Link>
            </div>
          </div>
        )}

        {/* Usage Calculator */}
        <div className="max-w-4xl mx-auto mb-16 bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-400" />
            Calculate Your Price
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <label htmlFor="monthly-volume" className="block text-sm font-medium text-slate-300 mb-2">
                Monthly Stripe Transaction Volume
              </label>
              <div className="flex items-center gap-4">
                <input
                  id="monthly-volume"
                  type="range"
                  min="0"
                  max="1000000"
                  step="10000"
                  value={monthlyVolume}
                  onChange={(e) => setMonthlyVolume(Number(e.target.value))}
                  className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-2xl font-bold text-white min-w-[100px] text-right">
                  {formatVolume(monthlyVolume)}
                </span>
              </div>
            </div>

            <div>
              <label htmlFor="ai-insights" className="block text-sm font-medium text-slate-300 mb-2">
                AI Insights Per Month
              </label>
              <div className="flex items-center gap-4">
                <input
                  id="ai-insights"
                  type="range"
                  min="0"
                  max="300"
                  step="5"
                  value={aiInsights}
                  onChange={(e) => setAiInsights(Number(e.target.value))}
                  className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-2xl font-bold text-white min-w-[100px] text-right">
                  {aiInsights}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
            <p className="text-sm text-slate-300">
              💡 <strong className="text-white">Pro Tip:</strong> Your price automatically adjusts based on your actual usage. 
              Start small and scale as you grow.
            </p>
          </div>
        </div>

        {/* Pricing Tiers */}
        <div className="mb-16">
          <PricingCards variant="dark" selectedPlan={selectedPlan} />
        </div>

        {/* Comparison Table */}
        <div className="max-w-5xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            Why RevPilot Wins
          </h2>
          <div className="overflow-x-auto bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-slate-300 font-semibold">Feature</th>
                  <th className="text-center p-4 text-white font-bold">RevPilot</th>
                  <th className="text-center p-4 text-slate-400">Baremetrics</th>
                  <th className="text-center p-4 text-slate-400">ChartMogul</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/10">
                  <td className="p-4 text-slate-300">Pricing Model</td>
                  <td className="p-4 text-center text-emerald-400 font-semibold">Usage-Based</td>
                  <td className="p-4 text-center text-slate-400">Fixed Tiers</td>
                  <td className="p-4 text-center text-slate-400">Fixed Tiers</td>
                </tr>
                <tr className="border-b border-white/10">
                  <td className="p-4 text-slate-300">Entry Price</td>
                  <td className="p-4 text-center text-emerald-400 font-semibold">$0 (Free)</td>
                  <td className="p-4 text-center text-slate-400">$108/mo</td>
                  <td className="p-4 text-center text-slate-400">$100/mo</td>
                </tr>
                <tr className="border-b border-white/10">
                  <td className="p-4 text-slate-300">AI Revenue Advisor</td>
                  <td className="p-4 text-center text-emerald-400">✓</td>
                  <td className="p-4 text-center text-slate-400">✗</td>
                  <td className="p-4 text-center text-slate-400">✗</td>
                </tr>
                <tr>
                  <td className="p-4 text-slate-300">Fair Pricing</td>
                  <td className="p-4 text-center text-emerald-400">✓ Pay as you grow</td>
                  <td className="p-4 text-center text-slate-400">✗ Fixed</td>
                  <td className="p-4 text-center text-slate-400">✗ Fixed</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            <details className="bg-white/5 backdrop-blur-lg rounded-lg border border-white/10 p-6">
              <summary className="text-lg font-semibold text-white cursor-pointer">
                How does usage-based pricing work?
              </summary>
              <p className="mt-4 text-slate-300">
                You pay a base price for your plan, plus additional charges only if you exceed your included limits. 
                This means you never overpay when starting out, and costs scale naturally with your business growth.
              </p>
            </details>

            <details className="bg-white/5 backdrop-blur-lg rounded-lg border border-white/10 p-6">
              <summary className="text-lg font-semibold text-white cursor-pointer">
                Can I change plans anytime?
              </summary>
              <p className="mt-4 text-slate-300">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, 
                and we'll prorate the difference on your next bill.
              </p>
            </details>

            <details className="bg-white/5 backdrop-blur-lg rounded-lg border border-white/10 p-6">
              <summary className="text-lg font-semibold text-white cursor-pointer">
                What counts as "transaction volume"?
              </summary>
              <p className="mt-4 text-slate-300">
                Transaction volume is the total dollar amount of successful charges processed through your Stripe account each month. 
                For example, if you process 100 payments of $50 each, that's $5,000 in transaction volume.
              </p>
            </details>

            <details className="bg-white/5 backdrop-blur-lg rounded-lg border border-white/10 p-6">
              <summary className="text-lg font-semibold text-white cursor-pointer">
                Is there a free trial?
              </summary>
              <p className="mt-4 text-slate-300">
                The Starter plan is free forever! For paid plans, you can start with a 14-day free trial 
                to explore all features before committing.
              </p>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
          Loading pricing...
        </div>
      }
    >
      <PricingPageContent />
    </Suspense>
  )
}
