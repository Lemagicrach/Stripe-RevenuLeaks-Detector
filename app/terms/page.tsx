import Link from 'next/link'
import { CompactWordmark } from '@/components/CompactWordmark'

export default function TermsPage() {
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
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Terms of Service</h1>
        <p className="text-gray-600 mb-8">Last updated: November 12, 2025</p>

        <div className="prose prose-lg max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Agreement to Terms</h2>
            <p className="text-gray-700 mb-4">
              By accessing or using RevPilot ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access the Service.
            </p>
            <p className="text-gray-700">
              These Terms apply to all visitors, users, and others who access or use the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Description of Service</h2>
            <p className="text-gray-700 mb-4">
              RevPilot is a Stripe analytics platform that provides:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Real-time metrics tracking (MRR, ARR, churn rates)</li>
              <li>AI-powered churn prevention insights</li>
              <li>Anonymous peer benchmarking</li>
              <li>Revenue scenario planning</li>
              <li>Stripe data synchronization and analysis</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Account Registration</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">3.1 Eligibility</h3>
            <p className="text-gray-700 mb-4">
              You must be at least 18 years old to use this Service. By using the Service, you represent and warrant that you meet this age requirement.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">3.2 Account Security</h3>
            <p className="text-gray-700 mb-4">
              You are responsible for:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized access</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">3.3 Accurate Information</h3>
            <p className="text-gray-700 mb-4">
              You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Subscription Plans and Billing</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">4.1 Pricing Tiers</h3>
            <div className="bg-gray-50 p-6 rounded-lg mb-4">
              <p className="text-gray-700 mb-2"><strong>Free:</strong> Free for businesses under $10K MRR</p>
              <p className="text-gray-700 mb-2"><strong>Pro:</strong> $29/month for $10K-$100K MRR</p>
              <p className="text-gray-700"><strong>Business:</strong> $79/month for $100K+ MRR</p>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">4.2 Billing</h3>
            <p className="text-gray-700 mb-4">
              Paid subscriptions are billed monthly in advance. You authorize us to charge your payment method on a recurring basis. Prices are subject to change with 30 days' notice.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">4.3 Cancellation and Refunds</h3>
            <p className="text-gray-700 mb-4">
              You may cancel your subscription at any time. Cancellations take effect at the end of the current billing period. We do not provide refunds for partial months or unused features.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">4.4 Tier Adjustments</h3>
            <p className="text-gray-700 mb-4">
              Your subscription tier is based on your reported MRR. If your MRR exceeds your current tier's limit, you agree to upgrade to the appropriate tier within 30 days.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Stripe Integration</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">5.1 Authorization</h3>
            <p className="text-gray-700 mb-4">
              By connecting your Stripe account, you authorize RevPilot to access your Stripe data as described in our Privacy Policy. This access is governed by Stripe's OAuth 2.0 protocol.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">5.2 Data Accuracy</h3>
            <p className="text-gray-700 mb-4">
              We strive to provide accurate analytics based on your Stripe data. However, we are not responsible for errors in your Stripe data or discrepancies caused by Stripe API limitations.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">5.3 Disconnection</h3>
            <p className="text-gray-700 mb-4">
              You may disconnect your Stripe account at any time. Disconnecting will prevent us from accessing new data but will not delete historical analytics.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Acceptable Use</h2>
            <p className="text-gray-700 mb-4">You agree not to:</p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Use the Service for any illegal purpose</li>
              <li>Violate any laws in your jurisdiction</li>
              <li>Infringe on intellectual property rights</li>
              <li>Transmit malicious code or viruses</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with or disrupt the Service</li>
              <li>Use automated systems to access the Service without permission</li>
              <li>Resell or redistribute the Service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Intellectual Property</h2>
            <p className="text-gray-700 mb-4">
              The Service and its original content, features, and functionality are owned by RevPilot and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </p>
            <p className="text-gray-700">
              Your Stripe data remains your property. By using the Service, you grant us a limited license to process and analyze your data to provide the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Disclaimer of Warranties</h2>
            <p className="text-gray-700 mb-4">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Warranties of merchantability</li>
              <li>Fitness for a particular purpose</li>
              <li>Non-infringement</li>
              <li>Accuracy or completeness of data</li>
              <li>Uninterrupted or error-free operation</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Limitation of Liability</h2>
            <p className="text-gray-700 mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, REVPILOT SHALL NOT BE LIABLE FOR:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Indirect, incidental, special, or consequential damages</li>
              <li>Loss of profits, revenue, data, or business opportunities</li>
              <li>Damages arising from your use or inability to use the Service</li>
              <li>Any amount exceeding the fees you paid in the 12 months preceding the claim</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Indemnification</h2>
            <p className="text-gray-700 mb-4">
              You agree to indemnify and hold harmless RevPilot, its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Your use of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any rights of another party</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Termination</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">11.1 By You</h3>
            <p className="text-gray-700 mb-4">
              You may terminate your account at any time by contacting us or using the account deletion feature in your dashboard.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">11.2 By Us</h3>
            <p className="text-gray-700 mb-4">
              We may suspend or terminate your account if you:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Violate these Terms</li>
              <li>Fail to pay applicable fees</li>
              <li>Engage in fraudulent or illegal activity</li>
              <li>Pose a security risk to the Service</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">11.3 Effect of Termination</h3>
            <p className="text-gray-700 mb-4">
              Upon termination, your right to use the Service will immediately cease. We will delete your data within 30 days unless required to retain it by law.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Changes to Terms</h2>
            <p className="text-gray-700 mb-4">
              We reserve the right to modify these Terms at any time. We will notify you of material changes by email or through the Service. Your continued use after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Governing Law</h2>
            <p className="text-gray-700 mb-4">
              These Terms shall be governed by and construed in accordance with the laws of [Your Jurisdiction], without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Dispute Resolution</h2>
            <p className="text-gray-700 mb-4">
              Any disputes arising from these Terms or your use of the Service shall be resolved through binding arbitration in accordance with [Arbitration Rules], except where prohibited by law.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">15. Severability</h2>
            <p className="text-gray-700 mb-4">
              If any provision of these Terms is found to be unenforceable or invalid, that provision will be limited or eliminated to the minimum extent necessary, and the remaining provisions will remain in full force and effect.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">16. Entire Agreement</h2>
            <p className="text-gray-700 mb-4">
              These Terms constitute the entire agreement between you and RevPilot regarding the Service and supersede all prior agreements and understandings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">17. Contact Information</h2>
            <p className="text-gray-700 mb-4">
              If you have questions about these Terms, please contact us:
            </p>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="text-gray-700"><strong>Email:</strong> legal@revpilot.com</p>
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
