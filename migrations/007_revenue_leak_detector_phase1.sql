-- migrations/007_revenue_leak_detector_phase1.sql
-- Phase 1: Revenue Leak Detector foundation
-- Adds invoices cache + revenue leaks tables.

-- Invoice cache (needed for failed payment / recovery gap leaks)
CREATE TABLE IF NOT EXISTS public.invoices_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_connection_id UUID REFERENCES public.stripe_connections(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL,
  customer_id TEXT,
  subscription_id TEXT,
  status TEXT NOT NULL,
  amount_due_cents BIGINT DEFAULT 0,
  amount_paid_cents BIGINT DEFAULT 0,
  attempt_count INTEGER DEFAULT 0,
  next_payment_attempt TIMESTAMPTZ,
  hosted_invoice_url TEXT,
  created_at_stripe TIMESTAMPTZ,
  updated_at_stripe TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stripe_connection_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS invoices_cache_conn_idx ON public.invoices_cache(stripe_connection_id);
CREATE INDEX IF NOT EXISTS invoices_cache_status_idx ON public.invoices_cache(status);
CREATE INDEX IF NOT EXISTS invoices_cache_created_idx ON public.invoices_cache(created_at_stripe);

-- Revenue leaks (decision engine output)
CREATE TABLE IF NOT EXISTS public.revenue_leaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_connection_id UUID REFERENCES public.stripe_connections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  leak_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  lost_amount_cents BIGINT NOT NULL DEFAULT 0,
  recoverable_amount_cents BIGINT NOT NULL DEFAULT 0,
  severity TEXT NOT NULL DEFAULT 'low',
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.70,

  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  recommended_action TEXT NOT NULL,

  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS revenue_leaks_conn_idx ON public.revenue_leaks(stripe_connection_id);
CREATE INDEX IF NOT EXISTS revenue_leaks_user_idx ON public.revenue_leaks(user_id);
CREATE INDEX IF NOT EXISTS revenue_leaks_type_idx ON public.revenue_leaks(leak_type);
CREATE INDEX IF NOT EXISTS revenue_leaks_period_idx ON public.revenue_leaks(period_start, period_end);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_revenue_leaks_updated_at ON public.revenue_leaks;
CREATE TRIGGER trg_revenue_leaks_updated_at
BEFORE UPDATE ON public.revenue_leaks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
