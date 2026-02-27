'use client';

import { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface PricingTier {
  name: string;
  displayName: string;
  price: number;
  includedVolume: number;
  includedInsights: number;
  overageRatePer10k: number;
  overageRatePerInsight: number;
  features: string[];
  popular?: boolean;
  cta: string;
}

const pricingTiers: PricingTier[] = [
  {
    name: 'starter',
    displayName: 'Free',
    price: 0,
    includedVolume: 10000,
    includedInsights: 5,
    overageRatePer10k: 0,
    overageRatePerInsight: 0,
    features: [
      'Up to $10K monthly transaction volume',
      '5 AI insights per month',
      'Basic dashboard access',
      '30-day data retention',
      'Community support',
    ],
    cta: 'Start Free',
  },
  {
    name: 'professional',
    displayName: 'Professional',
    price: 29,
    includedVolume: 100000,
    includedInsights: 50,
    overageRatePer10k: 5,
    overageRatePerInsight: 0.5,
    features: [
      'Up to $100K monthly transaction volume',
      '50 AI insights per month',
      'Full dashboard + benchmarking',
      '1-year data retention',
      'Email support',
      '$5 per additional $10K volume',
      '$0.50 per additional AI insight',
    ],
    popular: true,
    cta: 'Start 14-Day Trial',
  },
  {
    name: 'business',
    displayName: 'Business',
    price: 99,
    includedVolume: 500000,
    includedInsights: 200,
    overageRatePer10k: 3,
    overageRatePerInsight: 0.4,
    features: [
      'Up to $500K monthly transaction volume',
      '200 AI insights per month',
      'Priority support',
      'Unlimited data retention',
      'Custom reports',
      'Advanced analytics',
      '$3 per additional $10K volume',
      '$0.40 per additional AI insight',
    ],
    cta: 'Start 14-Day Trial',
  },
  {
    name: 'enterprise',
    displayName: 'Enterprise',
    price: 299,
    includedVolume: 999999999,
    includedInsights: 999999,
    overageRatePer10k: 0,
    overageRatePerInsight: 0,
    features: [
      'Unlimited transaction volume',
      'Unlimited AI insights',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantees',
      'White-label options',
    ],
    cta: 'Contact Sales',
  },
];

export default function PricingPage() {
  const [monthlyVolume, setMonthlyVolume] = useState(50000);
  const [aiInsights, setAiInsights] = useState(25);

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

        {/* Usage Calculator */}
        <div className="max-w-4xl mx-auto mb-16 bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-400" />
            Calculate Your Price
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <label
                className="block text-sm font-medium text-slate-300 mb-2"
                htmlFor="monthly-volume"
              >
                Monthly Stripe Transaction Volume
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  id="monthly-volume"
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
              <label
                className="block text-sm font-medium text-slate-300 mb-2"
                htmlFor="ai-insights"
              >
                AI Insights Per Month
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  id="ai-insights"
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
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {pricingTiers.map((tier) => {
            const calculatedPrice = calculatePrice(tier);
            const isOverIncluded = monthlyVolume > tier.includedVolume || aiInsights > tier.includedInsights;

            return (
              <div
                key={tier.name}
                className={`relative rounded-2xl p-6 ${
                  tier.popular
                    ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-2 border-indigo-500'
                    : 'bg-white/5 border border-white/10'
                } backdrop-blur-lg`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">{tier.displayName}</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-white">
                      ${tier.price === 0 ? '0' : calculatedPrice.toFixed(0)}
                    </span>
                    <span className="text-slate-400">/month</span>
                  </div>
                  {isOverIncluded && tier.price > 0 && (
                    <p className="text-sm text-emerald-400 mt-1">
                      Base ${tier.price} + ${(calculatedPrice - tier.price).toFixed(2)} usage
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-slate-300">
                      <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={tier.name === 'enterprise' ? '/contact' : '/signup'}
                  className={`block w-full py-3 px-4 rounded-lg font-semibold text-center transition-all ${
                    tier.popular
                      ? 'bg-indigo-500 hover:bg-indigo-600 text-white'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            );
          })}
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
        <div className="max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {[
              {
                q: 'How does usage-based pricing work?',
                a: 'You pay a base monthly fee plus additional charges only if you exceed your included limits. Your Stripe transaction volume and AI insights are automatically tracked.',
              },
              {
                q: 'What happens if I exceed my limits?',
                a: 'We automatically calculate overages at the end of your billing cycle. For example, on Professional plan with $120K volume (vs. $100K included), you pay an extra $10.',
              },
              {
                q: 'Can I change plans anytime?',
                a: 'Yes! Upgrade or downgrade anytime. Changes take effect at the start of your next billing cycle.',
              },
              {
                q: 'Is there a free trial?',
                a: 'Yes! All paid plans come with a 14-day free trial. No credit card required for the Free tier.',
              },
            ].map((faq, index) => (
              <details
                key={index}
                className="bg-white/5 backdrop-blur-lg rounded-lg p-4 border border-white/10"
              >
                <summary className="text-white font-semibold cursor-pointer">
                  {faq.q}
                </summary>
                <p className="mt-2 text-slate-300">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Join hundreds of SaaS founders who trust RevPilot
          </p>
          <Link
            href="/signup"
            className="inline-block bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 px-8 rounded-lg text-lg transition-all"
          >
            Start Free Today
          </Link>
        </div>
      </div>
    </div>
  );
}
