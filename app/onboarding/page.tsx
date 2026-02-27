"use client";

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Circle, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

/**
 * This onboarding page guides new users through connecting their Stripe account
 * and waiting for an initial sync before exploring their dashboard. The
 * marketing site often lives on a separate domain from the app's API. To
 * support this, API calls are made against the domain defined in
 * NEXT_PUBLIC_API_URL and navigations to the dashboard use
 * NEXT_PUBLIC_APP_URL. Both values should be defined in your environment
 * variables when running the marketing site. If undefined, relative
 * paths are used which will work when the app and API are served from
 * the same host.
 */

type ConnectionStatusResponse = {
  hasConnection: boolean;
  connectionId?: string | null;
  syncStatus?: 'ready' | 'syncing' | 'error' | null;
  syncProgress?: number | null;
  syncMessage?: string | null;
  lastSyncedAt?: string | null;
};

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const upgraded = searchParams?.get('upgraded') === 'true';
  const plan = searchParams?.get('plan') || 'starter';
  const sessionId = searchParams?.get('session_id') || null;

  const [currentStep, setCurrentStep] = useState(1);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [hasConnection, setHasConnection] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [subscriptionSyncing, setSubscriptionSyncing] = useState(false);
  const [subscriptionSyncMessage, setSubscriptionSyncMessage] = useState<string | null>(null);
  const [initialSyncStatus, setInitialSyncStatus] = useState<'idle' | 'syncing' | 'ready' | 'error'>('idle');
  const [initialSyncProgress, setInitialSyncProgress] = useState<number>(0);
  const [initialSyncMessage, setInitialSyncMessage] = useState<string | null>(null);
  const [hasTriggeredInitialSync, setHasTriggeredInitialSync] = useState(false);

  // Resolve base URLs. These env vars should be set in the marketing project
  // to point at the deployed app. Fallbacks allow unified deployment.
  const API_BASE_URL: string = process.env.NEXT_PUBLIC_API_URL || '';
  const APP_BASE_URL: string = process.env.NEXT_PUBLIC_APP_URL || '';

  const applyConnectionStatus = useCallback((data: ConnectionStatusResponse) => {
    const connected = Boolean(data.hasConnection);
    const normalizedConnectionId = data.connectionId || null;

    setHasConnection(connected);
    setConnectionId(normalizedConnectionId);

    if (!connected) {
      setCurrentStep(2);
      setInitialSyncStatus('idle');
      setInitialSyncProgress(0);
      setInitialSyncMessage(null);
      setHasTriggeredInitialSync(false);
      return;
    }

    const syncStatus = data.syncStatus || null;
    const isSyncReady = syncStatus === 'ready' || (Boolean(data.lastSyncedAt) && syncStatus !== 'syncing');

    if (isSyncReady) {
      setInitialSyncStatus('ready');
      setInitialSyncProgress(100);
      setInitialSyncMessage(
        data.syncMessage || 'Initial sync complete. You can continue to your dashboard.'
      );
      setCurrentStep(4);
      return;
    }

    if (syncStatus === 'error') {
      setInitialSyncStatus('error');
      setInitialSyncProgress(100);
      setInitialSyncMessage(data.syncMessage || 'Initial sync failed. Please retry.');
      setCurrentStep(3);
      return;
    }

    if (syncStatus === 'syncing') {
      setInitialSyncStatus('syncing');
      setInitialSyncProgress(data.syncProgress && data.syncProgress > 0 ? data.syncProgress : 5);
      setInitialSyncMessage(data.syncMessage || 'Syncing your data...');
      setCurrentStep(3);
      return;
    }

    setInitialSyncStatus('idle');
    setInitialSyncProgress(0);
    setInitialSyncMessage('Preparing your initial sync...');
    setCurrentStep(3);
  }, []);

  const triggerInitialSync = useCallback(
    async (targetConnectionId: string) => {
      setHasTriggeredInitialSync(true);
      setInitialSyncStatus('syncing');
      setInitialSyncProgress(5);
      setInitialSyncMessage('Starting initial sync...');

      try {
        const response = await fetch(`${API_BASE_URL}/api/stripe/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            connectionId: targetConnectionId,
            force: true,
          }),
        });

        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to start initial sync');
        }

        setInitialSyncStatus('syncing');
        setInitialSyncMessage('Initial sync started. This usually takes 30-60 seconds.');
      } catch (error: any) {
        setInitialSyncStatus('error');
        setInitialSyncProgress(100);
        setInitialSyncMessage(error?.message || 'Failed to start initial sync. Please retry.');
      }
    },
    [API_BASE_URL]
  );

  const steps = [
    {
      number: 1,
      title: upgraded ? '🎉 Welcome to RevPilot Pro!' : 'Welcome to RevPilot!',
      description: upgraded
        ? `You're now on the ${plan} plan. Let's get your dashboard set up!`
        : "Let's get you set up in 3 simple steps",
      completed: true,
    },
    {
      number: 2,
      title: 'Connect Your Stripe Account',
      description: 'We need access to your Stripe data to show you insights',
      action: 'connect',
      completed: hasConnection,
    },
    {
      number: 3,
      title: 'Wait for Initial Sync',
      description: 'We will fetch your subscription data (takes ~30 seconds)',
      completed: false,
    },
    {
      number: 4,
      title: 'Explore Your Dashboard',
      description: 'See your MRR, churn, and growth metrics',
      action: 'dashboard',
      completed: false,
    },
  ];

  // Check if user already has a Stripe connection. This call must send
  // credentials to include the session cookie. If the request fails or
  // returns false, we still allow the user to proceed to step 2.
  useEffect(() => {
    const checkConnection = async () => {
      setCheckingConnection(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/user/connection-status`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data: ConnectionStatusResponse = await response.json();
          applyConnectionStatus(data);
        } else {
          // non-OK response; still show connect step
          setCurrentStep(2);
        }
      } catch (error) {
        console.error('Error checking connection:', error);
        // on error, still show connect step
        setCurrentStep(2);
      } finally {
        setCheckingConnection(false);
      }
    };
    checkConnection();
  }, [API_BASE_URL, applyConnectionStatus]);

  useEffect(() => {
    if (!hasConnection || currentStep < 3) {
      return;
    }

    let cancelled = false;

    const pollSyncStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/user/connection-status`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!response.ok) {
          return;
        }

        const data: ConnectionStatusResponse = await response.json();
        if (cancelled) {
          return;
        }

        applyConnectionStatus(data);

        const syncStatus = data.syncStatus || null;
        const shouldStartInitialSync =
          Boolean(data.hasConnection) &&
          Boolean(data.connectionId) &&
          !data.lastSyncedAt &&
          syncStatus !== 'syncing' &&
          syncStatus !== 'ready' &&
          !hasTriggeredInitialSync;

        if (shouldStartInitialSync && data.connectionId) {
          void triggerInitialSync(data.connectionId);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error polling sync status:', error);
        }
      }
    };

    void pollSyncStatus();
    const intervalId = window.setInterval(pollSyncStatus, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    API_BASE_URL,
    applyConnectionStatus,
    currentStep,
    hasConnection,
    hasTriggeredInitialSync,
    triggerInitialSync,
  ]);

  // Handle syncing the subscription after checkout. This call uses the API
  // domain and sends credentials to include the session.
  const handleSyncSubscription = async () => {
    if (!sessionId) return;
    setSubscriptionSyncing(true);
    setSubscriptionSyncMessage(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/sync-stripe-session?session_id=${encodeURIComponent(
          sessionId
        )}`,
        {
          credentials: 'include',
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to sync subscription');
      }
      setSubscriptionSyncMessage('Subscription status refreshed. You can go to your dashboard now.');
    } catch (error: any) {
      setSubscriptionSyncMessage(error.message || 'Failed to sync subscription. Please try again.');
    } finally {
      setSubscriptionSyncing(false);
    }
  };

  // Kick off the Stripe OAuth flow. The API domain hosts the route for
  // initiating and handling OAuth. Setting window.location.href triggers
  // a full page redirect.
  const handleConnectStripe = () => {
    window.location.href = `${API_BASE_URL}/api/stripe/connect`;
  };

  // Navigate to the dashboard on the app domain. We use window.location.href
  // instead of router.push because we may be switching domains.
  const handleGoToDashboard = () => {
    const destination = `${APP_BASE_URL}/dashboard`;
    window.location.href = destination;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-500/20 rounded-full mb-4">
              <Sparkles className="w-8 h-8 text-indigo-400" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">
              {upgraded ? '🎉 You are All Set!' : 'Let Get Started'}
            </h1>
            <p className="text-xl text-slate-300">
              {upgraded
                ? 'Your subscription is active. Now connect your Stripe account.'
                : 'Follow these steps to start tracking your Stripe metrics'}
            </p>

            {upgraded && sessionId && (
              <div className="mt-4 flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={handleSyncSubscription}
                  disabled={subscriptionSyncing}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm text-slate-100 border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {subscriptionSyncing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Refreshing subscription status...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      Refresh subscription status
                    </>
                  )}
                </button>
                {subscriptionSyncMessage && (
                  <p className="text-sm text-slate-300 max-w-md">
                    {subscriptionSyncMessage}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Progress Steps */}
          <div className="space-y-6 mb-12">
            {steps.map((step, index) => {
              const isActive = currentStep === step.number;
              const isCompleted = step.completed || currentStep > step.number;
              return (
                <div
                  key={step.number}
                  className={`relative bg-white/5 backdrop-blur-lg rounded-2xl p-6 border transition-all ${
                    isActive
                      ? 'border-indigo-500 shadow-lg shadow-indigo-500/20'
                      : isCompleted
                      ? 'border-emerald-500/50'
                      : 'border-white/10'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Step Number/Icon */}
                    <div className="flex-shrink-0">
                      {isCompleted ? (
                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                      ) : isActive ? (
                        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
                          {step.number}
                        </div>
                      ) : (
                        <Circle className="w-8 h-8 text-slate-600" />
                      )}
                    </div>
                    {/* Step Content */}
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-2">
                        {step.title}
                      </h3>
                      <p className="text-slate-300 mb-4">
                        {step.description}
                      </p>
                      {/* Action Buttons */}
                      {isActive && step.action === 'connect' && !hasConnection && (
                        <button
                          onClick={handleConnectStripe}
                          disabled={checkingConnection}
                          className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {checkingConnection ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Checking...
                            </>
                          ) : (
                            <>
                              Connect Stripe
                              <ArrowRight className="w-5 h-5" />
                            </>
                          )}
                        </button>
                      )}
                      {isActive && step.action === 'connect' && hasConnection && (
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="font-semibold">Stripe Connected!</span>
                        </div>
                      )}
                      {isActive && step.action === 'dashboard' && (
                        <button
                          onClick={handleGoToDashboard}
                          className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                        >
                          Go to Dashboard
                          <ArrowRight className="w-5 h-5" />
                        </button>
                      )}
                      {step.number === 3 && currentStep === 3 && (
                        <>
                          {initialSyncStatus === 'error' ? (
                            <div className="space-y-3">
                              <p className="text-rose-300">
                                {initialSyncMessage || 'Initial sync failed. Please retry.'}
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  if (connectionId) {
                                    void triggerInitialSync(connectionId);
                                  }
                                }}
                                disabled={!connectionId}
                                className="inline-flex items-center gap-2 bg-rose-500/90 hover:bg-rose-500 text-white px-5 py-2.5 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Retry Initial Sync
                                <ArrowRight className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 text-slate-300">
                              <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                              <span>
                                {initialSyncMessage || 'Syncing your data... This usually takes 30-60 seconds'}
                                {initialSyncProgress > 0 ? ` (${initialSyncProgress}%)` : ''}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {/* Connector Line */}
                  {index < steps.length - 1 && (
                    <div className="absolute left-10 top-full w-0.5 h-6 bg-slate-700 -translate-x-1/2" />
                  )}
                </div>
              );
            })}
          </div>
          {/* Help Section */}
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-3">
              Need Help?
            </h3>
            <p className="text-slate-300 mb-4">
              If you're having trouble connecting your Stripe account or have questions about RevPilot:
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-medium transition-all"
              >
                📚 Read Documentation
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-medium transition-all"
              >
                💬 Contact Support
              </Link>
            </div>
          </div>
          {/* Skip Button */}
          <div className="text-center mt-8">
            <button
              onClick={handleGoToDashboard}
              className="text-slate-400 hover:text-white transition-colors"
            >
              Skip onboarding and go to dashboard →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-indigo-400 mx-auto mb-4" />
            <p className="text-slate-300">Loading...</p>
          </div>
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
