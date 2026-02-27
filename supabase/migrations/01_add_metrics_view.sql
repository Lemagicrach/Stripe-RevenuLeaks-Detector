-- 01_add_metrics_view.sql
CREATE OR REPLACE VIEW view_connection_metrics AS
SELECT
  stripe_connection_id,
  COUNT(DISTINCT customer_id) as total_customers,
  COUNT(*) FILTER (WHERE status IN ('active', 'trialing')) as active_subscriptions,
  COALESCE(SUM(mrr_amount) FILTER (WHERE status IN ('active', 'trialing')), 0) as mrr
FROM subscriptions_cache
GROUP BY stripe_connection_id;