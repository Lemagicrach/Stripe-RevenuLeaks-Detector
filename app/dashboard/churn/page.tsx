// app/dashboard/churn/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ChurnPreventionDashboard from '@/components/churn/churn-prevention-dashboard'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// ✅ CORRECTION 1 : Définition du type standardisé
type UserTier = 'starter' | 'professional' | 'business' | 'enterprise';

export default function ChurnPage() {
    const router = useRouter()
    const supabase = createClientComponentClient()

    const [connectionId, setConnectionId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    // ✅ CORRECTION 1 : Utilisation du type standardisé
    const [userTier, setUserTier] = useState<UserTier>('starter')

    useEffect(() => {
        async function loadConnection() {
            try {
                // Get current user
                const { data: { session }, error: sessionError } = await supabase.auth.getSession()

                if (sessionError) throw sessionError

                if (!session) {
                    router.push('/login')
                    return
                }

                // Get user's subscription tier
                const { data: profile, error: profileError } = await supabase
                    .from('user_profiles')
                    .select('subscription_tier')
                    .eq('user_id', session.user.id)
                    .single()

                if (profileError) {
                    console.error('Error loading profile:', profileError);
                    // Continuer sans tier si erreur, mais avec le tier 'starter' par défaut
                }
                
                // ✅ CORRECTION 2 : Mise à jour du userTier APRES la requête de profil
                if (profile?.subscription_tier) {
                    // Assurer que le type est correctement casté
                    setUserTier(profile.subscription_tier as UserTier)
                }
                
                // --- La requête mal placée a été retirée ici ---

                // Get user's active Stripe connection
                const { data: connections, error: connectionsError } = await supabase
                    .from('stripe_connections')
                    .select('id, account_id, is_active')
                    .eq('user_id', session.user.id)
                    .eq('is_active', true)
                    .order('created_at', { ascending: false })
                    .limit(1)

                if (connectionsError) throw connectionsError

                if (!connections || connections.length === 0) {
                    setError('no_connection')
                    setLoading(false)
                    return
                }

                setConnectionId(connections[0].id)
                setLoading(false)

            } catch (err) {
                console.error('Error loading connection:', err)
                setError('load_error')
                setLoading(false)
            }
        }

        loadConnection()
    }, [router, supabase])

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
                    <p className="text-gray-600">Loading churn prevention dashboard...</p>
                </div>
            </div>
        )
    }

    // Feature gating - Starter tier users see upgrade prompt
    if (userTier === 'starter') {
        return (
            <div className="min-h-screen bg-gray-50 p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                        <div className="text-6xl mb-4">🚀</div>
                        <h1 className="text-3xl font-bold mb-4">Upgrade to Access Churn Prevention</h1>
                        <p className="text-gray-600 mb-6 text-lg">
                            AI-powered churn prediction is available on **Professional** and Business plans.
                        </p>

                        <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6 mb-8">
                            <h2 className="text-xl font-semibold mb-4">What You'll Get:</h2>
                            <ul className="text-left space-y-3 max-w-md mx-auto">
                                <li className="flex items-start">
                                    <span className="text-green-500 mr-2">✓</span>
                                    <span>AI-powered churn risk prediction for every customer</span>
                                </li>
                                <li className="flex items-start">
                                    <span className="text-green-500 mr-2">✓</span>
                                    <span>Automated retention email generation</span>
                                </li>
                                <li className="flex items-start">
                                    <span className="text-green-500 mr-2">✓</span>
                                    <span>Real-time alerts for high-risk customers</span>
                                </li>
                                <li className="flex items-start">
                                    <span className="text-green-500 mr-2">✓</span>
                                    <span>ROI tracking for retention efforts</span>
                                </li>
                            </ul>
                        </div>

                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={() => router.push('/pricing')}
                                className="px-8 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition"
                            >
                                View Pricing
                            </button>
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
                            >
                                Back to Dashboard
                            </button>
                        </div>

                        <p className="text-sm text-gray-500 mt-6">
                            Professional plan starts at $29/month • Cancel anytime
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    // No connection error (Logic remains correct)
    if (error === 'no_connection') {
        // ... (Contenu de l'erreur pas de connexion)
        return (
            <div className="min-h-screen bg-gray-50 p-8">
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                        <div className="text-6xl mb-4">🔌</div>
                        <h1 className="text-2xl font-bold mb-4">Connect Your Stripe Account</h1>
                        <p className="text-gray-600 mb-6">
                            To use churn prevention features, you need to connect your Stripe account first.
                        </p>
                        <div className="flex gap-4 justify-center">
                            <a
                                href="/api/stripe/connect"
                                className="px-8 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition"
                            >
                                Connect Stripe
                            </a>
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
                            >
                                Back to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Load error (Logic remains correct)
    if (error === 'load_error') {
        // ... (Contenu de l'erreur de chargement)
        return (
            <div className="min-h-screen bg-gray-50 p-8">
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h1 className="text-2xl font-bold mb-4">Something Went Wrong</h1>
                        <p className="text-gray-600 mb-6">
                            We couldn't load your churn prevention dashboard. Please try again.
                        </p>
                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={() => window.location.reload()}
                                className="px-8 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition"
                            >
                                Retry
                            </button>
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="px-8 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
                            >
                                Back to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Success - render the dashboard
    if (!connectionId) {
        return null
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ✅ CORRECTION 3 : Passage du userTier au composant enfant pour plus de flexibilité */}
            <ChurnPreventionDashboard connectionId={connectionId} userTier={userTier} />
        </div>
    )
}