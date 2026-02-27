-- migrations/011_revenue_leak_detector_phase6.sql
-- Mirror of supabase/migrations/20260224_revenue_leak_detector_phase6.sql

ALTER TABLE public.revenue_recovery_events
ADD COLUMN IF NOT EXISTS leak_id UUID REFERENCES public.revenue_leaks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS revenue_recovery_events_leak_id_idx
ON public.revenue_recovery_events(leak_id);

CREATE TABLE IF NOT EXISTS public.stripe_connection_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_connection_id UUID REFERENCES public.stripe_connections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(stripe_connection_id, user_id)
);

CREATE INDEX IF NOT EXISTS stripe_connection_members_conn_idx
ON public.stripe_connection_members(stripe_connection_id);

CREATE INDEX IF NOT EXISTS stripe_connection_members_user_idx
ON public.stripe_connection_members(user_id);

ALTER TABLE public.stripe_connection_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='stripe_connection_members' AND policyname='scm_select_own'
  ) THEN
    CREATE POLICY scm_select_own
    ON public.stripe_connection_members
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='stripe_connection_members' AND policyname='scm_owner_manage'
  ) THEN
    CREATE POLICY scm_owner_manage
    ON public.stripe_connection_members
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.stripe_connections sc
        WHERE sc.id = stripe_connection_id AND sc.user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.stripe_connections sc
        WHERE sc.id = stripe_connection_id AND sc.user_id = auth.uid()
      )
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.leak_action_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_connection_id UUID REFERENCES public.stripe_connections(id) ON DELETE CASCADE,
  action_key TEXT NOT NULL,
  leak_type TEXT NOT NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(stripe_connection_id, action_key)
);

CREATE INDEX IF NOT EXISTS leak_action_assignments_conn_idx
ON public.leak_action_assignments(stripe_connection_id);

CREATE INDEX IF NOT EXISTS leak_action_assignments_assigned_to_idx
ON public.leak_action_assignments(assigned_to);

ALTER TABLE public.leak_action_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='leak_action_assignments' AND policyname='laa_select_team'
  ) THEN
    CREATE POLICY laa_select_team
    ON public.leak_action_assignments
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.stripe_connections sc
        WHERE sc.id = stripe_connection_id AND sc.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.stripe_connection_members m
        WHERE m.stripe_connection_id = stripe_connection_id AND m.user_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='leak_action_assignments' AND policyname='laa_upsert_team'
  ) THEN
    CREATE POLICY laa_upsert_team
    ON public.leak_action_assignments
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.stripe_connections sc
        WHERE sc.id = stripe_connection_id AND sc.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.stripe_connection_members m
        WHERE m.stripe_connection_id = stripe_connection_id AND m.user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.stripe_connections sc
        WHERE sc.id = stripe_connection_id AND sc.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.stripe_connection_members m
        WHERE m.stripe_connection_id = stripe_connection_id AND m.user_id = auth.uid()
      )
    );
  END IF;
END $$;
