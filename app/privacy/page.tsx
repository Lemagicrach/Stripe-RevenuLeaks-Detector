import Link from 'next/link'
import { CompactWordmark } from '@/components/CompactWordmark'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <nav className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <CompactWordmark href="/" size={32} theme="dark" textClassName="text-xl font-bold" />
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
        <p className="text-gray-600 mb-8">Last updated: November 12, 2025</p>

        <div className="prose prose-lg max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
            <p className="text-gray-700 mb-4">
              Welcome to RevPilot ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Stripe analytics service.
            </p>
            <p className="text-gray-700">
              By using RevPilot, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">2.1 Information You Provide</h3>
            <p className="text-gray-700 mb-4">We collect information that you voluntarily provide when you:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Create an account (name, email address, password)</li>
              <li>Connect your Stripe account</li>
              <li>Contact our support team</li>
              <li>Subscribe to our paid plans</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">2.2 Stripe Data</h3>
            <p className="text-gray-700 mb-4">
              When you connect your Stripe account, we access and process the following data from Stripe:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Customer information (anonymized for benchmarking)</li>
              <li>Subscription data</li>
              <li>Payment and transaction history</li>
              <li>Revenue metrics (MRR, ARR, churn rates)</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">2.3 Automatically Collected Information</h3>
            <p className="text-gray-700 mb-4">We automatically collect certain information when you use our service:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Device information (IP address, browser type, operating system)</li>
              <li>Usage data (pages visited, features used, time spent)</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
            <p className="text-gray-700 mb-4">We use your information to:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Provide and maintain our analytics service</li>
              <li>Process your Stripe data and generate insights</li>
              <li>Send you important updates and notifications</li>
              <li>Improve our service and develop new features</li>
              <li>Provide customer support</li>
              <li>Detect and prevent fraud or abuse</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Data Security</h2>
            <p className="text-gray-700 mb-4">
              We implement industry-standard security measures to protect your data:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>End-to-end encryption for data transmission</li>
              <li>Encrypted storage of sensitive information</li>
              <li>Row-level security (RLS) policies in our database</li>
              <li>Regular security audits and monitoring</li>
              <li>Secure OAuth 2.0 integration with Stripe</li>
            </ul>
            <p className="text-gray-700">
              However, no method of transmission over the Internet is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Data Sharing and Disclosure</h2>
            <p className="text-gray-700 mb-4">We do not sell your personal information. We may share your data in the following circumstances:</p>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">5.1 Service Providers</h3>
            <p className="text-gray-700 mb-4">
              We work with third-party service providers who help us operate our service:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Supabase (database and authentication)</li>
              <li>Vercel (hosting and deployment)</li>
              <li>OpenAI (AI-powered features)</li>
              <li>Stripe (payment processing)</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">5.2 Anonymous Benchmarking</h3>
            <p className="text-gray-700 mb-4">
              We use anonymized, aggregated data for our peer benchmarking feature. Individual user data is never shared or identifiable.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">5.3 Legal Requirements</h3>
            <p className="text-gray-700 mb-4">
              We may disclose your information if required by law or to protect our rights, property, or safety.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Your Rights</h2>
            <p className="text-gray-700 mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your account and data</li>
              <li><strong>Export:</strong> Download your data in a portable format</li>
              <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
            </ul>
            <p className="text-gray-700">
              To exercise these rights, please contact us at privacy@revpilot.com
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Data Retention</h2>
            <p className="text-gray-700 mb-4">
              We retain your personal information for as long as necessary to provide our service and comply with legal obligations. When you delete your account, we will delete or anonymize your data within 30 days, except where we are required to retain it by law.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Cookies and Tracking</h2>
            <p className="text-gray-700 mb-4">
              We use cookies and similar technologies to improve your experience. You can control cookie preferences through your browser settings. Note that disabling cookies may affect service functionality.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Children's Privacy</h2>
            <p className="text-gray-700 mb-4">
              Our service is not intended for users under 18 years of age. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. International Data Transfers</h2>
            <p className="text-gray-700 mb-4">
              Your data may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your data in accordance with this Privacy Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Changes to This Policy</h2>
            <p className="text-gray-700 mb-4">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date. Your continued use of our service after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Contact Us</h2>
            <p className="text-gray-700 mb-4">
              If you have questions about this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="text-gray-700"><strong>Email:</strong> privacy@revpilot.com</p>
              <p className="text-gray-700 mt-2"><strong>Address:</strong> [Your Business Address]</p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <Link href="/" className="text-indigo-600 hover:text-indigo-700 font-medium">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
