-- ============================================================================
-- RLS Audit Logging System for RevPilot Features
-- ============================================================================
-- 
-- This script creates a comprehensive audit logging system to track and
-- monitor potential Row Level Security (RLS) violations and suspicious
-- access patterns in Supabase.
--
-- Usage:
--   psql $DATABASE_URL -f rls-audit-logging.sql
--
-- ============================================================================

-- Create audit log table
CREATE TABLE IF NOT EXISTS rls_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User information
  user_id UUID,
  user_email TEXT,
  user_role TEXT,
  
  -- Request details
  attempted_table TEXT NOT NULL,
  attempted_action TEXT NOT NULL, -- SELECT, INSERT, UPDATE, DELETE
  attempted_connection_id UUID, -- The connection they tried to access
  
  -- Result
  blocked BOOLEAN DEFAULT false,
  error_message TEXT,
  rows_affected INTEGER DEFAULT 0,
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for efficient querying
CREATE INDEX idx_rls_audit_user_id ON rls_audit_log(user_id);
CREATE INDEX idx_rls_audit_created_at ON rls_audit_log(created_at DESC);
CREATE INDEX idx_rls_audit_blocked ON rls_audit_log(blocked) WHERE blocked = true;
CREATE INDEX idx_rls_audit_table_action ON rls_audit_log(attempted_table, attempted_action);
CREATE INDEX idx_rls_audit_user_blocked ON rls_audit_log(user_id, blocked) WHERE blocked = true;

-- ============================================================================
-- Audit Logging Functions
-- ============================================================================

-- Function to log access attempts
CREATE OR REPLACE FUNCTION log_rls_access(
  p_table TEXT,
  p_action TEXT,
  p_connection_id UUID DEFAULT NULL,
  p_blocked BOOLEAN DEFAULT false,
  p_error_message TEXT DEFAULT NULL,
  p_rows_affected INTEGER DEFAULT 0
) RETURNS void AS $$
BEGIN
  INSERT INTO rls_audit_log (
    user_id,
    user_email,
    user_role,
    attempted_table,
    attempted_action,
    attempted_connection_id,
    blocked,
    error_message,
    rows_affected,
    metadata
  ) VALUES (
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    (SELECT auth.jwt()->>'role'),
    p_table,
    p_action,
    p_connection_id,
    p_blocked,
    p_error_message,
    p_rows_affected,
    jsonb_build_object(
      'timestamp', NOW(),
      'session_id', current_setting('request.jwt.claims', true)::jsonb->>'session_id'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Trigger Functions for Automatic Audit Logging
-- ============================================================================

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit_table_access()
RETURNS TRIGGER AS $$
DECLARE
  v_connection_id UUID;
  v_action TEXT;
BEGIN
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_connection_id := NEW.stripe_connection_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_connection_id := NEW.stripe_connection_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_connection_id := OLD.stripe_connection_id;
  ELSE
    v_action := TG_OP;
  END IF;

  -- Check if user owns the connection
  IF v_connection_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM stripe_connections 
      WHERE id = v_connection_id 
      AND user_id = auth.uid()
    ) THEN
      -- Log blocked attempt
      PERFORM log_rls_access(
        TG_TABLE_NAME,
        v_action,
        v_connection_id,
        true,
        'Attempted to access another user''s data',
        0
      );
      
      -- Raise exception to block the operation
      RAISE EXCEPTION 'Access denied: You do not own this connection';
    END IF;
  END IF;

  -- Log successful access (non-blocking)
  PERFORM log_rls_access(
    TG_TABLE_NAME,
    v_action,
    v_connection_id,
    false,
    NULL,
    1
  );

  -- Return appropriate value based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Apply Audit Triggers to Protected Tables
-- ============================================================================

-- Churn Predictions
CREATE TRIGGER audit_churn_predictions_access
  BEFORE INSERT OR UPDATE OR DELETE ON churn_predictions
  FOR EACH ROW
  EXECUTE FUNCTION audit_table_access();

-- Churn Interventions
CREATE TRIGGER audit_churn_interventions_access
  BEFORE INSERT OR UPDATE OR DELETE ON churn_interventions
  FOR EACH ROW
  EXECUTE FUNCTION audit_table_access();

-- Benchmark Participants
CREATE TRIGGER audit_benchmark_participants_access
  BEFORE INSERT OR UPDATE OR DELETE ON benchmark_participants
  FOR EACH ROW
  EXECUTE FUNCTION audit_table_access();

-- Revenue Scenarios
CREATE TRIGGER audit_revenue_scenarios_access
  BEFORE INSERT OR UPDATE OR DELETE ON revenue_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION audit_table_access();

-- Scenario Comparisons
CREATE TRIGGER audit_scenario_comparisons_access
  BEFORE INSERT OR UPDATE OR DELETE ON scenario_comparisons
  FOR EACH ROW
  EXECUTE FUNCTION audit_table_access();

-- User Benchmark Comparisons
CREATE TRIGGER audit_user_benchmark_comparisons_access
  BEFORE INSERT OR UPDATE OR DELETE ON user_benchmark_comparisons
  FOR EACH ROW
  EXECUTE FUNCTION audit_table_access();

-- ============================================================================
-- Monitoring Views
-- ============================================================================

-- View: Recent blocked access attempts
CREATE OR REPLACE VIEW v_recent_blocked_attempts AS
SELECT 
  id,
  user_id,
  user_email,
  attempted_table,
  attempted_action,
  attempted_connection_id,
  error_message,
  created_at
FROM rls_audit_log
WHERE blocked = true
ORDER BY created_at DESC
LIMIT 100;

-- View: Suspicious users (multiple blocked attempts)
CREATE OR REPLACE VIEW v_suspicious_users AS
SELECT 
  user_id,
  user_email,
  COUNT(*) as blocked_attempts,
  COUNT(DISTINCT attempted_table) as tables_attempted,
  MIN(created_at) as first_attempt,
  MAX(created_at) as last_attempt,
  array_agg(DISTINCT attempted_table) as attempted_tables
FROM rls_audit_log
WHERE blocked = true
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id, user_email
HAVING COUNT(*) > 5
ORDER BY blocked_attempts DESC;

-- View: Access patterns by table
CREATE OR REPLACE VIEW v_access_patterns_by_table AS
SELECT 
  attempted_table,
  attempted_action,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE blocked = true) as blocked_attempts,
  COUNT(*) FILTER (WHERE blocked = false) as successful_attempts,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE blocked = true) / COUNT(*),
    2
  ) as block_rate_percent
FROM rls_audit_log
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY attempted_table, attempted_action
ORDER BY blocked_attempts DESC;

-- View: Hourly access statistics
CREATE OR REPLACE VIEW v_hourly_access_stats AS
SELECT 
  date_trunc('hour', created_at) as hour,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE blocked = true) as blocked_attempts,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT attempted_table) as tables_accessed
FROM rls_audit_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY date_trunc('hour', created_at)
ORDER BY hour DESC;

-- View: User activity summary
CREATE OR REPLACE VIEW v_user_activity_summary AS
SELECT 
  user_id,
  user_email,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE blocked = true) as blocked_attempts,
  COUNT(*) FILTER (WHERE blocked = false) as successful_attempts,
  COUNT(DISTINCT attempted_table) as tables_accessed,
  MIN(created_at) as first_access,
  MAX(created_at) as last_access
FROM rls_audit_log
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id, user_email
ORDER BY total_attempts DESC;

-- ============================================================================
-- Alert Functions
-- ============================================================================

-- Function to detect anomalous access patterns
CREATE OR REPLACE FUNCTION detect_anomalous_access()
RETURNS TABLE(
  alert_type TEXT,
  user_id UUID,
  user_email TEXT,
  severity TEXT,
  details TEXT,
  detected_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Alert 1: Multiple blocked attempts in short time
  RETURN QUERY
  SELECT 
    'multiple_blocked_attempts'::TEXT as alert_type,
    l.user_id,
    l.user_email,
    'high'::TEXT as severity,
    format('%s blocked attempts in last hour', COUNT(*)) as details,
    NOW() as detected_at
  FROM rls_audit_log l
  WHERE l.blocked = true
    AND l.created_at > NOW() - INTERVAL '1 hour'
  GROUP BY l.user_id, l.user_email
  HAVING COUNT(*) >= 10;

  -- Alert 2: Access to multiple different connections
  RETURN QUERY
  SELECT 
    'multiple_connection_access'::TEXT as alert_type,
    l.user_id,
    l.user_email,
    'medium'::TEXT as severity,
    format('Attempted to access %s different connections', COUNT(DISTINCT l.attempted_connection_id)) as details,
    NOW() as detected_at
  FROM rls_audit_log l
  WHERE l.blocked = true
    AND l.created_at > NOW() - INTERVAL '1 hour'
    AND l.attempted_connection_id IS NOT NULL
  GROUP BY l.user_id, l.user_email
  HAVING COUNT(DISTINCT l.attempted_connection_id) >= 5;

  -- Alert 3: Unusual time access (outside business hours)
  RETURN QUERY
  SELECT 
    'unusual_time_access'::TEXT as alert_type,
    l.user_id,
    l.user_email,
    'low'::TEXT as severity,
    format('Access attempts at %s (outside business hours)', to_char(l.created_at, 'HH24:MI')) as details,
    l.created_at as detected_at
  FROM rls_audit_log l
  WHERE l.blocked = true
    AND l.created_at > NOW() - INTERVAL '24 hours'
    AND (
      EXTRACT(HOUR FROM l.created_at) < 6 
      OR EXTRACT(HOUR FROM l.created_at) > 22
    );

  -- Alert 4: Rapid successive attempts
  RETURN QUERY
  SELECT 
    'rapid_successive_attempts'::TEXT as alert_type,
    l.user_id,
    l.user_email,
    'high'::TEXT as severity,
    format('%s attempts in 5 minutes', COUNT(*)) as details,
    NOW() as detected_at
  FROM rls_audit_log l
  WHERE l.blocked = true
    AND l.created_at > NOW() - INTERVAL '5 minutes'
  GROUP BY l.user_id, l.user_email
  HAVING COUNT(*) >= 20;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Monitoring Queries (Run these regularly)
-- ============================================================================

-- Query 1: Show blocked attempts in last 24 hours
COMMENT ON VIEW v_recent_blocked_attempts IS 
'Shows the 100 most recent blocked access attempts. Run this daily to identify potential security issues.

Usage:
  SELECT * FROM v_recent_blocked_attempts;
';

-- Query 2: Identify suspicious users
COMMENT ON VIEW v_suspicious_users IS 
'Identifies users with multiple blocked attempts in the last 24 hours (threshold: 5+ attempts).

Usage:
  SELECT * FROM v_suspicious_users;
';

-- Query 3: Access patterns by table
COMMENT ON VIEW v_access_patterns_by_table IS 
'Shows access patterns and block rates for each table over the last 7 days.

Usage:
  SELECT * FROM v_access_patterns_by_table;
';

-- Query 4: Detect anomalies
COMMENT ON FUNCTION detect_anomalous_access IS 
'Detects anomalous access patterns and generates alerts with severity levels.

Usage:
  SELECT * FROM detect_anomalous_access();
';

-- ============================================================================
-- Cleanup Functions
-- ============================================================================

-- Function to archive old audit logs
CREATE OR REPLACE FUNCTION archive_old_audit_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Archive to a separate table (optional)
  CREATE TABLE IF NOT EXISTS rls_audit_log_archive (LIKE rls_audit_log INCLUDING ALL);
  
  -- Move old records to archive
  WITH moved_rows AS (
    DELETE FROM rls_audit_log
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL
    RETURNING *
  )
  INSERT INTO rls_audit_log_archive
  SELECT * FROM moved_rows;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Scheduled Monitoring (Setup with pg_cron or external scheduler)
-- ============================================================================

-- Example: Daily security report
CREATE OR REPLACE FUNCTION generate_daily_security_report()
RETURNS TABLE(
  report_date DATE,
  total_attempts BIGINT,
  blocked_attempts BIGINT,
  unique_users BIGINT,
  suspicious_users BIGINT,
  high_severity_alerts BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CURRENT_DATE as report_date,
    COUNT(*) as total_attempts,
    COUNT(*) FILTER (WHERE blocked = true) as blocked_attempts,
    COUNT(DISTINCT user_id) as unique_users,
    (SELECT COUNT(*) FROM v_suspicious_users) as suspicious_users,
    (SELECT COUNT(*) FROM detect_anomalous_access() WHERE severity = 'high') as high_severity_alerts
  FROM rls_audit_log
  WHERE created_at >= CURRENT_DATE
    AND created_at < CURRENT_DATE + INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Real-time Monitoring Queries
-- ============================================================================

-- Query: Current active suspicious activity
CREATE OR REPLACE FUNCTION get_current_threats()
RETURNS TABLE(
  threat_level TEXT,
  user_email TEXT,
  recent_blocked_count BIGINT,
  last_attempt TIMESTAMPTZ,
  attempted_tables TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN COUNT(*) >= 20 THEN 'CRITICAL'
      WHEN COUNT(*) >= 10 THEN 'HIGH'
      WHEN COUNT(*) >= 5 THEN 'MEDIUM'
      ELSE 'LOW'
    END as threat_level,
    l.user_email,
    COUNT(*) as recent_blocked_count,
    MAX(l.created_at) as last_attempt,
    array_agg(DISTINCT l.attempted_table) as attempted_tables
  FROM rls_audit_log l
  WHERE l.blocked = true
    AND l.created_at > NOW() - INTERVAL '1 hour'
  GROUP BY l.user_email
  ORDER BY recent_blocked_count DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Performance Monitoring
-- ============================================================================

-- Query: Audit log size and growth
CREATE OR REPLACE VIEW v_audit_log_stats AS
SELECT 
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as records_last_24h,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as records_last_7d,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as records_last_30d,
  pg_size_pretty(pg_total_relation_size('rls_audit_log')) as table_size,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM rls_audit_log;

-- ============================================================================
-- Alert Notification Function (Integrate with external systems)
-- ============================================================================

-- Function to get alerts for external notification systems
CREATE OR REPLACE FUNCTION get_alerts_for_notification()
RETURNS TABLE(
  alert_id UUID,
  severity TEXT,
  message TEXT,
  user_email TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gen_random_uuid() as alert_id,
    a.severity,
    format('[%s] %s - %s', a.severity, a.alert_type, a.details) as message,
    a.user_email,
    a.detected_at as created_at
  FROM detect_anomalous_access() a
  WHERE a.severity IN ('high', 'critical')
  ORDER BY 
    CASE a.severity
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      ELSE 4
    END,
    a.detected_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Usage Examples and Best Practices
-- ============================================================================

/*
DAILY MONITORING ROUTINE:

1. Check for suspicious users:
   SELECT * FROM v_suspicious_users;

2. Review recent blocked attempts:
   SELECT * FROM v_recent_blocked_attempts LIMIT 20;

3. Check current threats:
   SELECT * FROM get_current_threats();

4. Generate daily report:
   SELECT * FROM generate_daily_security_report();

5. Check for anomalies:
   SELECT * FROM detect_anomalous_access() WHERE severity IN ('high', 'critical');

WEEKLY MONITORING ROUTINE:

1. Review access patterns:
   SELECT * FROM v_access_patterns_by_table;

2. Check audit log size:
   SELECT * FROM v_audit_log_stats;

3. Archive old logs (keep 90 days):
   SELECT archive_old_audit_logs(90);

MONTHLY MONITORING ROUTINE:

1. Review user activity summary:
   SELECT * FROM v_user_activity_summary;

2. Analyze trends:
   SELECT 
     date_trunc('day', created_at) as day,
     COUNT(*) as total_attempts,
     COUNT(*) FILTER (WHERE blocked = true) as blocked_attempts
   FROM rls_audit_log
   WHERE created_at > NOW() - INTERVAL '30 days'
   GROUP BY date_trunc('day', created_at)
   ORDER BY day;

REAL-TIME ALERTS:

Set up a cron job or Edge Function to run every 5 minutes:

SELECT * FROM get_alerts_for_notification();

Send results to Slack, email, or monitoring system.
*/

-- ============================================================================
-- Grant Permissions
-- ============================================================================

-- Allow authenticated users to trigger audit logging (read-only on audit table)
ALTER TABLE rls_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs" ON rls_audit_log
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role can manage audit logs" ON rls_audit_log
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Grant execute permissions on monitoring functions
GRANT EXECUTE ON FUNCTION log_rls_access TO authenticated;
GRANT EXECUTE ON FUNCTION detect_anomalous_access TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_threats TO authenticated;
GRANT EXECUTE ON FUNCTION generate_daily_security_report TO authenticated;
GRANT EXECUTE ON FUNCTION get_alerts_for_notification TO service_role;

-- ============================================================================
-- Verification
-- ============================================================================

-- Verify audit system is set up correctly
DO $$
BEGIN
  RAISE NOTICE 'Audit logging system installed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Run: SELECT * FROM v_audit_log_stats;';
  RAISE NOTICE '2. Test: SELECT * FROM detect_anomalous_access();';
  RAISE NOTICE '3. Monitor: SELECT * FROM v_suspicious_users;';
  RAISE NOTICE '';
  RAISE NOTICE 'For help, see comments in this file.';
END $$;
