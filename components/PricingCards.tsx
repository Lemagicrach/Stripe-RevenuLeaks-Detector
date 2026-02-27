import { pricingTiers } from '@/lib/pricing-tiers'

type Variant = 'light' | 'dark'

interface PricingCardsProps {
  variant?: Variant
  showEnterprise?: boolean
}

const baseCardClasses =
  'relative rounded-2xl p-8 border-2 transition shadow-sm'

const variants: Record<Variant, { card: string; header: string; body: string; muted: string; badge: string; ctaPrimary: string; ctaSecondary: string }> = {
  light: {
    card: 'bg-white border-gray-200 text-gray-900',
    header: 'text-gray-900',
    body: 'text-gray-600',
    muted: 'text-gray-600',
    badge: 'bg-indigo-600 text-white',
    ctaPrimary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/50',
    ctaSecondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
  },
  dark: {
    card: 'bg-white/5 border-white/10 text-white backdrop-blur-lg',
    header: 'text-white',
    body: 'text-slate-300',
    muted: 'text-slate-300',
    badge: 'bg-indigo-500 text-white',
    ctaPrimary: 'bg-indigo-500 text-white hover:bg-indigo-600',
    ctaSecondary: 'bg-white/10 text-white hover:bg-white/20',
  },
}

export function PricingCards({ variant = 'light', showEnterprise = true }: PricingCardsProps) {
  const theme = variants[variant]
  const getCtaHref = (planId: string) => {
    if (planId === 'starter') return '/signup'
    if (planId === 'enterprise') return '/contact'
    return `/pricing?plan=${planId}`
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
      {pricingTiers
        .filter(tier => showEnterprise || tier.planId !== 'enterprise')
        .map(tier => (
          <div
            key={tier.planId}
            className={`${baseCardClasses} ${theme.card} ${
              tier.popular ? 'border-indigo-600 shadow-md' : ''
            }`}
          >
            {tier.popular && (
              <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-sm font-semibold ${theme.badge}`}>
                Most Popular
              </div>
            )}
            <h3 className={`text-2xl font-bold mb-2 ${theme.header}`}>{tier.displayName}</h3>
            <p className={`mb-6 ${theme.body}`}>{tier.description}</p>
            <div className="mb-6">
              <span className="text-5xl font-bold">${tier.price}</span>
              <span className={`ml-1 ${theme.muted}`}>/month</span>
            </div>
            <ul className="space-y-3 mb-6">
              {tier.features.slice(0, 5).map((feature, idx) => (
                <li key={idx} className={`flex items-start gap-3 text-sm ${theme.body}`}>
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <a
              href={getCtaHref(tier.planId)}
              className={`block w-full text-center px-6 py-3 rounded-lg font-semibold ${tier.popular ? theme.ctaPrimary : theme.ctaSecondary}`}
            >
              {tier.cta}
            </a>
          </div>
        ))}
    </div>
  )
}
