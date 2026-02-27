/* This component fetches revenue leak alerts from `/api/alerts` and
 * displays them in a card. Free users will see a blurred card with a CTA
 * to upgrade, while paid users see a list of detected revenue signals.
 */
'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, TrendingDown } from 'lucide-react';

interface RevenueSignal {
  id: string;
  type: string;
  severity: string;
  value: number | null;
  detected_at: string;
  meta?: any;
}

export default function RevenueAlertsCard() {
  const [loading, setLoading] = useState(true);
  const [restricted, setRestricted] = useState(false);
  const [signals, setSignals] = useState<RevenueSignal[]>([]);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const res = await fetch('/api/alerts');
        if (!res.ok) {
          throw new Error('Failed to fetch alerts');
        }
        const data = await res.json();
        if (data?.restricted) {
          setRestricted(true);
        } else {
          setSignals(data?.signals || []);
        }
      } catch (error) {
        console.error('Error fetching alerts:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchAlerts();
  }, []);

  // Map signal types to icons and human-readable labels.
  const renderSignal = (signal: RevenueSignal) => {
    let icon = <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 mr-2" />;
    let title = signal.type;
    let description = '';

    if (signal.type === 'churn_spike') {
      icon = <TrendingDown className="w-5 h-5 text-red-500 dark:text-red-400 mr-2" />;
      title = 'Churn Spike';
      if (signal.value !== null) {
        description = `Churn increased by ${signal.value?.toFixed(1)}% compared to last period.`;
      } else {
        description = 'Churn increased significantly.';
      }
    } else if (signal.type === 'payment_failure') {
      icon = <AlertTriangle className="w-5 h-5 text-yellow-500 dark:text-yellow-400 mr-2" />;
      title = 'Payment Failures';
      if (signal.value !== null) {
        description = `${signal.value} failed payments detected in the last 7 days.`;
      } else {
        description = 'Spike in failed payments detected.';
      }
    }

    return (
      <li
        key={signal.id}
        className="flex items-start gap-2 p-3 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
      >
        {icon}
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {title}{' '}
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
              ({new Date(signal.detected_at).toLocaleDateString()})
            </span>
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{description}</p>
        </div>
      </li>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center">
        <AlertCircle className="w-5 h-5 text-indigo-500 dark:text-indigo-400 mr-2" />
        Revenue Alerts
      </h2>
      {loading ? (
        <p className="text-sm text-gray-700 dark:text-gray-300">Loading alerts...</p>
      ) : restricted ? (
        <div>
          {/* Blurred content placeholder for free plans */}
          <div className="relative overflow-hidden rounded-lg">
            <div className="blur-sm select-none pointer-events-none">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                You have revenue alerts pending. Upgrade to Pro to see details.
              </p>
            </div>
          </div>
          <a
            href="/pricing"
            className="mt-4 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all"
          >
            Unlock Pro Alerts
          </a>
        </div>
      ) : signals.length === 0 ? (
        <p className="text-sm text-gray-700 dark:text-gray-300">No revenue alerts detected. 🎉</p>
      ) : (
        <ul className="space-y-3">{signals.map(renderSignal)}</ul>
      )}
    </div>
  );
}