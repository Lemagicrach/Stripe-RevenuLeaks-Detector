-- migrations/008_revenue_leak_detector_phase3.sql
-- Phase 3: Action Center + Email report preferences

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS email_reports_enabled BOOLEAN DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS public.leak_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_connection_id UUID REFERENCES public.stripe_connections(id) ON DELETE SET NULL,
  sent_to TEXT,
  subject TEXT,
  provider_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leak_email_log_user_idx ON public.leak_email_log(user_id);
CREATE INDEX IF NOT EXISTS leak_email_log_created_idx ON public.leak_email_log(created_at);
