-- supabase/migrations/20260224_revenue_leak_detector_phase5.sql
-- Phase 5: Instant alerts (toast + email) + recovery attribution + persisted fix checklist

-- 1) Attribute recovery events by leak type (best-effort; nullable)
ALTER TABLE public.revenue_recovery_events
ADD COLUMN IF NOT EXISTS leak_type TEXT,
ADD COLUMN IF NOT EXISTS source_event_type TEXT;

CREATE INDEX IF NOT EXISTS revenue_recovery_events_leak_type_idx
ON public.revenue_recovery_events(leak_type);

-- 2) Persist user action checklist state (Action Center)
CREATE TABLE IF NOT EXISTS public.leak_action_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_connection_id UUID REFERENCES public.stripe_connections(id) ON DELETE CASCADE,
  action_key TEXT NOT NULL,
  leak_type TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, stripe_connection_id, action_key)
);

CREATE INDEX IF NOT EXISTS leak_action_state_user_idx ON public.leak_action_state(user_id);
CREATE INDEX IF NOT EXISTS leak_action_state_conn_idx ON public.leak_action_state(stripe_connection_id);

ALTER TABLE public.leak_action_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='leak_action_state' AND policyname='leak_action_state_select_own'
  ) THEN
    CREATE POLICY leak_action_state_select_own
    ON public.leak_action_state
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='leak_action_state' AND policyname='leak_action_state_upsert_own'
  ) THEN
    CREATE POLICY leak_action_state_upsert_own
    ON public.leak_action_state
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 3) Leak notifications for toast + email alerting
CREATE TABLE IF NOT EXISTS public.leak_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_connection_id UUID REFERENCES public.stripe_connections(id) ON DELETE CASCADE,
  leak_id UUID REFERENCES public.revenue_leaks(id) ON DELETE CASCADE,
  leak_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'in_app', -- in_app | email
  provider_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS leak_notifications_user_idx ON public.leak_notifications(user_id);
CREATE INDEX IF NOT EXISTS leak_notifications_created_idx ON public.leak_notifications(created_at);
CREATE INDEX IF NOT EXISTS leak_notifications_read_idx ON public.leak_notifications(read_at);
CREATE INDEX IF NOT EXISTS leak_notifications_channel_idx ON public.leak_notifications(channel);

-- Deduplicate repeated notifications per leak/channel
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='leak_notifications_dedupe_idx'
  ) THEN
    CREATE UNIQUE INDEX leak_notifications_dedupe_idx
    ON public.leak_notifications(leak_id, channel);
  END IF;
END $$;

ALTER TABLE public.leak_notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='leak_notifications' AND policyname='leak_notifications_select_own'
  ) THEN
    CREATE POLICY leak_notifications_select_own
    ON public.leak_notifications
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='leak_notifications' AND policyname='leak_notifications_update_own'
  ) THEN
    CREATE POLICY leak_notifications_update_own
    ON public.leak_notifications
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
