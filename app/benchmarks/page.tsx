'use client'

export default function BenchmarksPage() {
  const benchmarks = [
    {
      category: 'Early Stage SaaS (< $10K MRR)',
      metrics: {
        mrr: '$5,000',
        arpu: '$49',
        churnRate: '8%',
        ltv: '$600',
        cac: '$150',
      },
    },
    {
      category: 'Growth Stage SaaS ($10K - $100K MRR)',
      metrics: {
        mrr: '$45,000',
        arpu: '$99',
        churnRate: '5%',
        ltv: '$1,980',
        cac: '$400',
      },
    },
    {
      category: 'Scale Stage SaaS ($100K+ MRR)',
      metrics: {
        mrr: '$250,000',
        arpu: '$299',
        churnRate: '3%',
        ltv: '$9,967',
        cac: '$1,200',
      },
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            SaaS Metrics Benchmarks
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Compare your Stripe analytics to industry averages across different growth stages.
            Data aggregated from 500+ SaaS businesses.
          </p>
        </div>

        {/* Benchmarks Grid */}
        <div className="grid gap-8 md:grid-cols-3 mb-12">
          {benchmarks.map((benchmark, index) => (
            <div
              key={index}
              className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {benchmark.category}
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Median MRR:</span>
                  <span className="font-semibold text-gray-900">{benchmark.metrics.mrr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">ARPU:</span>
                  <span className="font-semibold text-gray-900">{benchmark.metrics.arpu}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Churn Rate:</span>
                  <span className="font-semibold text-gray-900">{benchmark.metrics.churnRate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">LTV:</span>
                  <span className="font-semibold text-gray-900">{benchmark.metrics.ltv}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">CAC:</span>
                  <span className="font-semibold text-gray-900">{benchmark.metrics.cac}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="bg-white rounded-lg shadow-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Want to see how YOUR SaaS compares?
          </h2>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Connect your Stripe account to RevPilot and get personalized benchmarks,
            AI-powered insights, and actionable recommendations to grow your revenue.
          </p>
          <div className="flex gap-4 justify-center">
            <a
              href="/signup"
              className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
            >
              Get Started Free
            </a>
            <a
              href="/"
              className="px-6 py-3 bg-gray-100 text-gray-900 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              Learn More
            </a>
          </div>
        </div>

        {/* SEO Content */}
        <div className="mt-12 prose prose-lg max-w-4xl mx-auto bg-white p-8 rounded-lg shadow">
          <h2>Understanding SaaS Metrics</h2>
          <p>
            <strong>Monthly Recurring Revenue (MRR)</strong> is the lifeblood of any SaaS business.
            It represents the predictable revenue you can expect each month from your subscriptions.
          </p>
          <p>
            <strong>Average Revenue Per User (ARPU)</strong> tells you how much each customer is worth
            on average. Higher ARPU often means you're targeting the right customer segment.
          </p>
          <p>
            <strong>Churn Rate</strong> is the percentage of customers who cancel their subscriptions.
            For early-stage SaaS, 5-7% monthly churn is typical, but you should aim for under 5%.
          </p>
          <p>
            <strong>Customer Lifetime Value (LTV)</strong> predicts the total revenue you'll earn from
            a customer over their entire relationship with your business.
          </p>
          <p>
            <strong>Customer Acquisition Cost (CAC)</strong> is how much you spend to acquire each new customer.
            A healthy SaaS business has an LTV:CAC ratio of at least 3:1.
          </p>
        </div>
      </div>
    </div>
  )
}
