import Link from 'next/link'
import styles from './page.module.css'
import { LandingHashScroll } from '@/components/LandingHashScroll'

const tickerCards = [
  {
    type: 'Failed payment - no retry',
    description: 'Card declined 3 days ago, no dunning email sent',
    amount: '-$149/mo',
    tone: 'red',
    icon: '⚠',
  },
  {
    type: 'Trial expired - no conversion nudge',
    description: '14-day trial ended, customer never contacted',
    amount: '-$79/mo',
    tone: 'yellow',
    icon: '⏳',
  },
  {
    type: 'Subscription stuck in "past_due"',
    description: 'Active user, payment failed 12 days ago, still using product',
    amount: '-$299/mo',
    tone: 'red',
    icon: '⚠',
  },
  {
    type: 'Cancellation wave detected',
    description: '4 cancellations in 48h from same pricing tier',
    amount: '-$596/mo',
    tone: 'yellow',
    icon: '⏳',
  },
]

const problemCards = [
  {
    number: '9%',
    title: 'Lost to failed payments',
    description:
      'The average SaaS loses 9% of MRR monthly to involuntary churn from card failures that never get resolved.',
  },
  {
    number: '23%',
    title: 'Trials that vanish',
    description:
      'Nearly 1 in 4 trials expire without any follow-up. These are users who already showed intent.',
  },
  {
    number: '$0',
    title: 'Recovered by default',
    description:
      "Stripe's built-in retry logic is minimal. Without active recovery, failed payments stay failed.",
  },
]

const steps = [
  {
    number: '01',
    title: 'Connect Stripe',
    description: 'OAuth with read-only permissions. We never touch your API keys or modify any data.',
    time: '30 seconds',
  },
  {
    number: '02',
    title: 'We scan everything',
    description:
      'Failed payments, stuck subscriptions, trial drop-offs, churn velocity, pricing anomalies - every signal that points to money leaving your account.',
    time: '2-4 minutes',
  },
  {
    number: '03',
    title: 'Get your leak report',
    description:
      "A clear breakdown of what's leaking, how much it's costing you, and exactly what to fix - ranked by dollar impact.",
  },
  {
    number: '04',
    title: 'Monitor continuously',
    description:
      'New leaks get flagged in real time. Alerts when churn spikes, payments fail in clusters, or a high-value customer goes quiet.',
  },
]

const leakCards = [
  {
    icon: '💳',
    title: 'Failed payments without recovery',
    description: 'Declined cards with no retry schedule or dunning email. Revenue that just disappears.',
    stat: 'Avg. recoverable: $380/mo per SaaS',
  },
  {
    icon: '⏸',
    title: 'Subscriptions stuck in limbo',
    description: 'Past-due, incomplete, or active subscriptions where the customer stopped paying weeks ago.',
    stat: 'Found in 68% of scanned accounts',
  },
  {
    icon: '📉',
    title: 'Silent churn patterns',
    description: 'Clusters of cancellations from the same plan, cohort, or time period that signal a deeper problem.',
    stat: 'Detected 14 days before it hits MRR',
  },
  {
    icon: '🔔',
    title: 'Trial-to-paid drop-offs',
    description: 'Trials that expire without a conversion email, payment method prompt, or any engagement signal.',
    stat: '23% avg. trial abandonment rate',
  },
  {
    icon: '🏷',
    title: 'Pricing misconfigurations',
    description: 'Coupons that never expire, legacy plans with outdated pricing, customers grandfathered below cost.',
    stat: 'Avg. $200/mo in underpriced subs',
  },
  {
    icon: '🤖',
    title: 'AI-powered diagnostics',
    description: 'Ask questions in plain English about any metric. Get answers with context, not just numbers.',
    stat: 'Powered by real-time Stripe data',
  },
]

const comparisonRows = [
  {
    label: 'Revenue leak detection',
    revpilot: 'check',
    chartmogul: 'dash',
    baremetrics: 'dash',
  },
  {
    label: 'Leak dollar impact scoring',
    revpilot: 'check',
    chartmogul: 'dash',
    baremetrics: 'dash',
  },
  {
    label: 'Real-time churn alerts',
    revpilot: 'check',
    chartmogul: 'dash',
    baremetrics: 'check',
  },
  {
    label: 'MRR / ARR / churn tracking',
    revpilot: 'check',
    chartmogul: 'check',
    baremetrics: 'check',
  },
  {
    label: 'AI Q&A on metrics',
    revpilot: 'check',
    chartmogul: 'dash',
    baremetrics: 'dash',
  },
  {
    label: 'Free tier',
    revpilot: 'check:<$10K',
    chartmogul: 'check:<$10K',
    baremetrics: 'dash:$108/mo',
  },
  {
    label: 'Setup time',
    revpilot: 'check:5 min',
    chartmogul: '10 min',
    baremetrics: '10 min',
  },
]

const pricing = [
  {
    tag: 'Free',
    name: 'Starter',
    price: '$0',
    note: 'Under $10K MRR',
    features: [
      'Full leak scan',
      'MRR, churn, revenue tracking',
      '5 AI queries/month',
      '30-day data retention',
    ],
    ctaText: 'Scan for free →',
    href: '/connect',
    featured: false,
    ghost: false,
  },
  {
    tag: 'Most popular',
    name: 'Growth',
    price: '$29',
    note: 'Up to $100K MRR',
    features: [
      'Continuous leak monitoring',
      'Real-time churn alerts',
      '50 AI queries/month',
      '1-year data retention',
      'Email support',
    ],
    ctaText: 'Start 14-day trial →',
    href: '/pricing?plan=professional',
    featured: true,
    ghost: false,
  },
  {
    tag: 'Scale',
    name: 'Business',
    price: '$99',
    note: 'Up to $500K MRR',
    features: [
      'Everything in Growth',
      '200 AI queries/month',
      'Custom leak reports',
      'Unlimited retention',
      'Priority support',
    ],
    ctaText: 'Start 14-day trial',
    href: '/pricing?plan=business',
    featured: false,
    ghost: true,
  },
]

const faqs = [
  {
    q: 'What exactly is a "revenue leak"?',
    a: "Any revenue you should be collecting but aren't - failed payments without retry, expired trials without follow-up, subscriptions stuck in broken states, or pricing errors that undercharge customers.",
  },
  {
    q: "How is this different from Stripe's dashboard?",
    a: "Stripe shows you what happened. RevPilot shows you what's going wrong - silently. We surface the patterns, anomalies, and broken flows that do not show up in a revenue chart.",
  },
  {
    q: 'Is my Stripe data safe?',
    a: 'We connect via OAuth with read-only access. We never see your API keys, never modify your data, and you can disconnect in one click at any time.',
  },
  {
    q: "I'm already using ChartMogul / Baremetrics",
    a: "RevPilot does not replace your analytics dashboard - it complements it. Those tools show metrics. We find the problems hiding inside those metrics. Many users run both.",
  },
  {
    q: 'How fast does it work?',
    a: 'Connect Stripe, and your first leak report is ready in under 5 minutes. Continuous monitoring starts immediately after.',
  },
  {
    q: 'What if no leaks are found?',
    a: "Then you're running a tight ship and the scan cost you nothing. But in 90%+ of accounts we scan, we find recoverable revenue.",
  },
]

const cellText = (value: string) => {
  if (value.startsWith('check:') || value.startsWith('dash:')) {
    return value.split(':')[1] || ''
  }
  if (value === 'check') return '✓'
  if (value === 'dash') return '-'
  return value
}

const cellClass = (value: string) => {
  if (value === 'check' || value.startsWith('check:')) return styles.tableCheck
  if (value === 'dash' || value.startsWith('dash:')) return styles.tableDash
  return ''
}

export default function HomePage() {
  return (
    <div className={styles.page}>
      <LandingHashScroll />
      <nav className={styles.nav}>
        <Link href="/" className={styles.navLogo}>
          <span className={styles.logoDot} />
          RevPilot
        </Link>

        <div className={styles.navLinks}>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
          <Link href="/connect" className={`${styles.btnPrimary} ${styles.navCta}`}>
            Connect Stripe
          </Link>
        </div>
      </nav>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroGlow} />
          <div className={`${styles.heroBadge} ${styles.fadeUp}`}>
            <span className={styles.pulse} />
            Revenue leak scanner
          </div>
          <h1 className={styles.fadeUp}>
            Your Stripe account is <span className={styles.highlight}>leaking revenue.</span>
            <br />
            RevPilot finds it.
          </h1>
          <p className={styles.fadeUp}>
            Failed payments nobody follows up on. Subscriptions stuck in limbo. Churn patterns you do not see until
            it is too late. Connect your Stripe and get a leak report in under 5 minutes.
          </p>
          <div className={`${styles.heroCta} ${styles.fadeUp}`}>
            <Link href="/connect" className={styles.btnPrimary}>
              Scan my Stripe for free →
            </Link>
            <a href="#how" className={styles.btnGhost}>
              See what we detect
            </a>
          </div>
          <p className={`${styles.heroSubtext} ${styles.fadeUp}`}>
            Read-only access · Free under $10K MRR · Disconnect anytime
          </p>
        </section>

        <section className={styles.tickerSection}>
          <p className={styles.tickerLabel}>Leaks detected in the last 24 hours across RevPilot users</p>
          <div className={styles.tickerCards}>
            {tickerCards.map((item) => (
              <article key={item.type} className={styles.tickerCard}>
                <div className={styles.tickerLeft}>
                  <div
                    className={`${styles.tickerIcon} ${item.tone === 'red' ? styles.tickerIconRed : styles.tickerIconYellow}`}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <p className={styles.tickerType}>{item.type}</p>
                    <p className={styles.tickerDescription}>{item.description}</p>
                  </div>
                </div>
                <span className={styles.tickerAmount}>{item.amount}</span>
              </article>
            ))}
          </div>
        </section>

        <section>
          <div className={styles.problem}>
            <header className={styles.sectionHeader}>
              <h2>The leaks nobody talks about</h2>
              <p>Stripe shows you revenue. It does not show you what you are silently losing every month.</p>
            </header>
            <div className={styles.problemGrid}>
              {problemCards.map((card, index) => (
                <article
                  key={card.title}
                  className={`${styles.problemCard} ${styles.fadeUp}`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <p className={styles.problemNumber}>{card.number}</p>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className={styles.anchorSection}>
          <div className={styles.howSection}>
            <header className={styles.sectionHeader}>
              <h2>From connected to leak report in 5 minutes</h2>
              <p>No code. No spreadsheets. No 45-minute onboarding calls.</p>
            </header>
            <div className={styles.steps}>
              {steps.map((step) => (
                <article key={step.number} className={styles.step}>
                  <div className={styles.stepNum}>{step.number}</div>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                    {step.time ? <span className={styles.stepTime}>{step.time}</span> : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className={styles.leaksSection}>
            <header className={styles.sectionHeader}>
              <h2>What RevPilot catches that Stripe does not show you</h2>
            </header>
            <div className={styles.leaksGrid}>
              {leakCards.map((item) => (
                <article key={item.title} className={styles.leakCard}>
                  <p className={styles.leakIcon}>{item.icon}</p>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <p className={styles.leakStat}>{item.stat}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className={styles.vsSection}>
            <header className={styles.sectionHeader}>
              <h2>RevPilot vs. the alternatives</h2>
              <p>Others show you dashboards. We show you what is broken.</p>
            </header>
            <div className={styles.tableWrap}>
              <table className={styles.vsTable}>
                <thead>
                  <tr>
                    <th aria-label="Feature" />
                    <th className={styles.tableHighlight}>RevPilot</th>
                    <th>ChartMogul</th>
                    <th>Baremetrics</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td className={cellClass(row.revpilot)}>{cellText(row.revpilot)}</td>
                      <td className={cellClass(row.chartmogul)}>{cellText(row.chartmogul)}</td>
                      <td className={cellClass(row.baremetrics)}>{cellText(row.baremetrics)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="pricing" className={styles.anchorSection}>
          <div className={styles.pricingSection}>
            <header className={styles.sectionHeader}>
              <h2>One scan can pay for a year</h2>
              <p>Free for early-stage. Priced to save you multiples of what you pay.</p>
            </header>
            <div className={styles.pricingGrid}>
              {pricing.map((plan) => (
                <article key={plan.name} className={`${styles.priceCard} ${plan.featured ? styles.featured : ''}`}>
                  <p className={styles.priceTag}>{plan.tag}</p>
                  <h3>{plan.name}</h3>
                  <p className={styles.price}>
                    {plan.price} <span>/mo</span>
                  </p>
                  <p className={styles.priceNote}>{plan.note}</p>
                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <Link href={plan.href} className={plan.ghost ? styles.btnGhost : styles.btnPrimary}>
                    {plan.ctaText}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className={styles.anchorSection}>
          <div className={styles.faqSection}>
            <header className={styles.sectionHeader}>
              <h2>Questions</h2>
            </header>
            {faqs.map((item) => (
              <details key={item.q} className={styles.faqItem}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.bottomCta}>
          <h2>Find out what Stripe isn't telling you</h2>
          <p>Connect in 30 seconds. Get your leak report in 5 minutes. Free under $10K MRR.</p>
          <Link href="/connect" className={styles.btnPrimary}>
            Scan my Stripe account →
          </Link>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>© 2025 RevPilot</p>
        <div className={styles.footerLinksInline}>
          <Link href="/privacy">Privacy</Link>
          <Link href="/contact">Contact</Link>
        </div>
      </footer>
    </div>
  )
}
