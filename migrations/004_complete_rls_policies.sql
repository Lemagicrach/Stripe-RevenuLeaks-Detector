-- ✅ Complete RLS Policies for All Tables
-- Run this in Supabase SQL Editor

-- ===========================================
-- stripe_connections table
-- ===========================================

-- Allow users to insert their own connections
CREATE POLICY "Users can insert their own stripe_connections"
ON stripe_connections FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own connections
CREATE POLICY "Users can update their own stripe_connections"
ON stripe_connections FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own connections
CREATE POLICY "Users can delete their own stripe_connections"
ON stripe_connections FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ===========================================
-- metrics_snapshots table
-- ===========================================

CREATE POLICY "Users can view their own metrics_snapshots"
ON metrics_snapshots FOR SELECT
TO authenticated
USING (
  stripe_connection_id IN (
    SELECT id FROM stripe_connections WHERE user_id = auth.uid()
  )
);

-- Service role can insert (from sync jobs)
CREATE POLICY "Service role can insert metrics_snapshots"
ON metrics_snapshots FOR INSERT
TO service_role
WITH CHECK (true);

-- Service role can update
CREATE POLICY "Service role can update metrics_snapshots"
ON metrics_snapshots FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- ===========================================
-- subscription_events table
-- ===========================================

CREATE POLICY "Users can view their own subscription_events"
ON subscription_events FOR SELECT
TO authenticated
USING (
  stripe_connection_id IN (
    SELECT id FROM stripe_connections WHERE user_id = auth.uid()
  )
);

-- Service role can insert
CREATE POLICY "Service role can insert subscription_events"
ON subscription_events FOR INSERT
TO service_role
WITH CHECK (true);

-- ===========================================
-- cohort_analysis table
-- ===========================================

CREATE POLICY "Users can view their own cohort_analysis"
ON cohort_analysis FOR SELECT
TO authenticated
USING (
  stripe_connection_id IN (
    SELECT id FROM stripe_connections WHERE user_id = auth.uid()
  )
);

-- Service role can insert/update
CREATE POLICY "Service role can manage cohort_analysis"
ON cohort_analysis FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ===========================================
-- sync_logs table
-- ===========================================

CREATE POLICY "Users can view their own sync_logs"
ON sync_logs FOR SELECT
TO authenticated
USING (
  stripe_connection_id IN (
    SELECT id FROM stripe_connections WHERE user_id = auth.uid()
  )
);

-- Service role can insert
CREATE POLICY "Service role can insert sync_logs"
ON sync_logs FOR INSERT
TO service_role
WITH CHECK (true);

-- ===========================================
-- Add missing indexes for performance
-- ===========================================

-- Index on status columns (frequently queried)
CREATE INDEX IF NOT EXISTS idx_stripe_connections_status 
ON stripe_connections(status);

CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_date 
ON metrics_snapshots(snapshot_date DESC);

-- Composite index for time-series queries
CREATE INDEX IF NOT EXISTS idx_metrics_time_series 
ON metrics_snapshots(stripe_connection_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_events_date 
ON subscription_events(event_date DESC);

-- ===========================================
-- Verify policies are working
-- ===========================================

-- Run this query to check all policies:
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;