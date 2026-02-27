import { Check, Zap, Users, Clock } from 'lucide-react'

export default function LifetimeDealPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="inline-block bg-red-100 text-red-700 px-4 py-2 rounded-full text-sm font-semibold mb-6 animate-pulse">
          🔥 LIMITED TIME: Only 100 Lifetime Deals Available
        </div>
        
        <h1 className="text-5xl font-bold mb-6">
          Get RevPilot Pro for Life.<br />
          <span className="text-blue-600">Pay Once. Use Forever.</span>
        </h1>
        
        <p className="text-xl text-gray-600 mb-8">
          Skip the $79/month subscription. Get all Pro features for a one-time payment of $299.
        </p>

        {/* Countdown or Spots Remaining */}
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 mb-8 max-w-md mx-auto">
          <div className="text-3xl font-bold text-gray-900 mb-2">87 / 100</div>
          <div className="text-sm text-gray-600">Lifetime deals remaining</div>
        </div>

        {/* CTA Button */}
        <a
          href="https://your-gumroad-link.com"
          className="inline-block bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
          Get Lifetime Access - $299
        </a>
        
        <p className="text-sm text-gray-500 mt-4">
          ✓ Instant access · ✓ No monthly fees · ✓ 30-day money-back guarantee
        </p>
      </div>

      {/* Price Comparison */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">The Math is Simple</h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          {/* Baremetrics */}
          <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
            <div className="text-center mb-4">
              <div className="text-gray-600 font-semibold mb-2">Baremetrics</div>
              <div className="text-4xl font-bold text-gray-900">$108</div>
              <div className="text-gray-500">/month</div>
            </div>
            <div className="text-center text-gray-600">
              <div className="mb-2">Year 1: <span className="font-semibold">$1,296</span></div>
              <div className="mb-2">Year 2: <span className="font-semibold">$1,296</span></div>
              <div className="mb-2">Year 3: <span className="font-semibold">$1,296</span></div>
              <div className="pt-4 border-t font-bold text-lg">$3,888</div>
            </div>
          </div>

          {/* RevPilot Monthly */}
          <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
            <div className="text-center mb-4">
              <div className="text-gray-600 font-semibold mb-2">RevPilot Pro</div>
              <div className="text-4xl font-bold text-gray-900">$79</div>
              <div className="text-gray-500">/month</div>
            </div>
            <div className="text-center text-gray-600">
              <div className="mb-2">Year 1: <span className="font-semibold">$948</span></div>
              <div className="mb-2">Year 2: <span className="font-semibold">$948</span></div>
              <div className="mb-2">Year 3: <span className="font-semibold">$948</span></div>
              <div className="pt-4 border-t font-bold text-lg">$2,844</div>
            </div>
          </div>

          {/* RevPilot Lifetime */}
          <div className="bg-gradient-to-b from-blue-50 to-blue-100 rounded-lg border-2 border-blue-500 p-6 relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
              BEST VALUE
            </div>
            <div className="text-center mb-4">
              <div className="text-blue-800 font-semibold mb-2">RevPilot Lifetime</div>
              <div className="text-4xl font-bold text-blue-900">$299</div>
              <div className="text-blue-700">one-time</div>
            </div>
            <div className="text-center text-blue-800">
              <div className="mb-2">Year 1: <span className="font-semibold">$299</span></div>
              <div className="mb-2">Year 2: <span className="font-semibold line-through">$0</span> FREE</div>
              <div className="mb-2">Year 3: <span className="font-semibold line-through">$0</span> FREE</div>
              <div className="pt-4 border-t font-bold text-lg text-blue-900">$299</div>
              <div className="text-sm mt-2 font-semibold">Save $2,545 over 3 years</div>
            </div>
          </div>
        </div>

        <div className="text-center mt-12">
          <a
            href="https://your-gumroad-link.com"
            className="inline-block bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg"
          >
            Claim Your Lifetime Deal - $299
          </a>
        </div>
      </div>

      {/* What's Included */}
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Everything Included. Forever.</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { icon: Zap, title: 'Real-Time MRR Tracking', desc: 'See your monthly recurring revenue update automatically' },
            { icon: Users, title: 'Unlimited Customers', desc: 'Track metrics for all your customers, no limits' },
            { icon: Check, title: 'Churn Analysis', desc: 'Understand why customers leave and when' },
            { icon: Clock, title: 'Cohort Retention', desc: 'See retention rates by signup month' },
            { icon: Zap, title: 'Customer LTV', desc: 'Calculate lifetime value per customer' },
            { icon: Users, title: 'ARPU Tracking', desc: 'Average revenue per user, updated daily' },
            { icon: Check, title: 'Priority Support', desc: 'Get help faster with lifetime deal support' },
            { icon: Clock, title: 'All Future Updates', desc: 'Every new feature we build, included free' },
          ].map((feature, i) => (
            <div key={i} className="flex gap-4 items-start bg-white p-6 rounded-lg border border-gray-200">
              <div className="bg-blue-100 p-2 rounded-lg">
                <feature.icon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Social Proof Section */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Join the Founding Members</h2>
          
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="text-3xl font-bold text-blue-600 mb-2">100</div>
              <div className="text-gray-600">Lifetime spots available</div>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="text-3xl font-bold text-green-600 mb-2">$2,545</div>
              <div className="text-gray-600">Savings over 3 years</div>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="text-3xl font-bold text-purple-600 mb-2">∞</div>
              <div className="text-gray-600">Years of access</div>
            </div>
          </div>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-8 text-center">
            <h3 className="text-2xl font-bold mb-4">Your Name on the Founding Members Page</h3>
            <p className="text-gray-700 mb-6">
              Every lifetime deal buyer gets listed on our "Founding Members" page as a thank you for believing in us early.
            </p>
            <a
              href="https://your-gumroad-link.com"
              className="inline-block bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Become a Founding Member - $299
            </a>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
        
        <div className="space-y-6">
          {[
            {
              q: 'What happens after February 1st?',
              a: 'The lifetime deal goes away forever. After Feb 1st, the only option will be $79/month. No more one-time payments.'
            },
            {
              q: 'What if I have questions or need help?',
              a: 'Lifetime deal members get priority support via email. We typically respond within 24 hours.'
            },
            {
              q: 'Can I upgrade from Free to Lifetime later?',
              a: 'Nope! This offer is only available during the launch period. After 100 spots are sold, it\'s gone forever.'
            },
            {
              q: 'Do you have a money-back guarantee?',
              a: 'Yes! 30-day full refund, no questions asked. If RevPilot doesn\'t work for you, just email us.'
            },
            {
              q: 'What if RevPilot shuts down?',
              a: 'Fair question. If we ever shut down, we\'ll give you 90 days notice and help you export all your data.'
            },
            {
              q: 'Can I use this for multiple Stripe accounts?',
              a: 'One lifetime deal = one Stripe account. But you can switch accounts anytime.'
            },
          ].map((faq, i) => (
            <div key={i} className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-lg mb-2">{faq.q}</h3>
              <p className="text-gray-600">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Final CTA */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 py-16">
        <div className="max-w-3xl mx-auto px-4 text-center text-white">
          <h2 className="text-4xl font-bold mb-6">
            Stop Paying Monthly Fees.<br />
            Own Your Analytics Forever.
          </h2>
          <p className="text-xl mb-8 text-blue-100">
            87 lifetime spots remaining. Once they're gone, this offer never comes back.
          </p>
          <a
            href="https://yazansali.gumroad.com/l/kedpj"
            className="inline-block bg-white text-blue-600 px-10 py-5 rounded-lg text-xl font-bold hover:bg-blue-50 transition-colors shadow-xl"
          >
            Get Lifetime Access - $299
          </a>
          <p className="text-sm text-blue-200 mt-6">
            ✓ 30-day money-back guarantee · ✓ Instant access · ✓ No recurring fees ever
          </p>
        </div>
      </div>

      {/* Trust Badges */}
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="flex justify-center items-center gap-8 text-gray-500 text-sm">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            <span>Secure Payment</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            <span>30-Day Guarantee</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            <span>Instant Access</span>
          </div>
        </div>
      </div>
    </div>
  )
}