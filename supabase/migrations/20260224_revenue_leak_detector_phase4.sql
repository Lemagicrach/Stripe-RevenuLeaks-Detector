-- supabase/migrations/20260224_revenue_leak_detector_phase4.sql
-- Phase 4: Real-time alerts (Stripe webhooks) + recovery tracking + playbooks support

-- 1) Store webhook endpoint info for connected accounts (real-time alerts)
ALTER TABLE public.stripe_connections
ADD COLUMN IF NOT EXISTS webhook_endpoint_id TEXT,
ADD COLUMN IF NOT EXISTS webhook_secret TEXT,
ADD COLUMN IF NOT EXISTS webhook_status TEXT DEFAULT 'inactive';

CREATE INDEX IF NOT EXISTS stripe_connections_webhook_status_idx
ON public.stripe_connections(webhook_status);

-- 2) Recovery tracking (money actually recovered)
CREATE TABLE IF NOT EXISTS public.revenue_recovery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_connection_id UUID REFERENCES public.stripe_connections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL,
  recovered_amount_cents BIGINT NOT NULL DEFAULT 0,
  recovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(stripe_connection_id, invoice_id, recovered_at)
);

CREATE INDEX IF NOT EXISTS revenue_recovery_events_conn_idx
ON public.revenue_recovery_events(stripe_connection_id);

CREATE INDEX IF NOT EXISTS revenue_recovery_events_user_idx
ON public.revenue_recovery_events(user_id);

CREATE INDEX IF NOT EXISTS revenue_recovery_events_recovered_at_idx
ON public.revenue_recovery_events(recovered_at);
