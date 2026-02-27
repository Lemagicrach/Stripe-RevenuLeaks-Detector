sql
-- migrations/003_stripe_analytics.sql

-- Stripe account connections
CREATE TABLE IF NOT EXISTS stripe_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id TEXT UNIQUE NOT NULL,
  access_token TEXT NOT NULL, -- Encrypted
  refresh_token TEXT,
  business_name TEXT,
  currency TEXT DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Metrics snapshots (daily rollups)
CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_connection_id UUID REFERENCES stripe_connections(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  
  -- Revenue metrics
  mrr DECIMAL(12,2) DEFAULT 0,
  arr DECIMAL(12,2) DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  
  -- MRR movement
  new_mrr DECIMAL(12,2) DEFAULT 0,
  expansion_mrr DECIMAL(12,2) DEFAULT 0,
  contraction_mrr DECIMAL(12,2) DEFAULT 0,
  churned_mrr DECIMAL(12,2) DEFAULT 0,
  reactivation_mrr DECIMAL(12,2) DEFAULT 0,
  
  -- Customer metrics
  total_customers INTEGER DEFAULT 0,
  active_subscriptions INTEGER DEFAULT 0,
  new_customers INTEGER DEFAULT 0,
  churned_customers INTEGER DEFAULT 0,
  
  -- Financial metrics
  arpu DECIMAL(10,2) DEFAULT 0,
  ltv DECIMAL(10,2) DEFAULT 0,
  
  -- Churn rates
  customer_churn_rate DECIMAL(5,2) DEFAULT 0,
  revenue_churn_rate DECIMAL(5,2) DEFAULT 0,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(stripe_connection_id, snapshot_date)
);

-- Subscription cache
CREATE TABLE IF NOT EXISTS subscriptions_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_connection_id UUID REFERENCES stripe_connections(id) ON DELETE CASCADE,
  subscription_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  mrr_amount DECIMAL(10,2) DEFAULT 0,
  interval TEXT,
  currency TEXT DEFAULT 'USD',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at_stripe TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  plan_name TEXT,
  price_id TEXT,
  quantity INTEGER DEFAULT 1,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stripe_connection_id, subscription_id)
);

-- Customer cache
CREATE TABLE IF NOT EXISTS customers_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_connection_id UUID REFERENCES stripe_connections(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  email TEXT,
  name TEXT,
  lifetime_value DECIMAL(10,2) DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  subscription_count INTEGER DEFAULT 0,
  created_at_stripe TIMESTAMPTZ,
  first_subscription_date TIMESTAMPTZ,
  last_subscription_date TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stripe_connection_id, customer_id)
);

-- Cohorts
CREATE TABLE IF NOT EXISTS cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_connection_id UUID REFERENCES stripe_connections(id) ON DELETE CASCADE,
  cohort_month DATE NOT NULL,
  customers_count INTEGER DEFAULT 0,
  initial_mrr DECIMAL(10,2) DEFAULT 0,
  retention_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stripe_connection_id, cohort_month)
);

-- Sync logs
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_connection_id UUID REFERENCES stripe_connections(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL,
  subscriptions_synced INTEGER DEFAULT 0,
  customers_synced INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_stripe_connections_user ON stripe_connections(user_id);
CREATE INDEX idx_metrics_snapshots_connection_date ON metrics_snapshots(stripe_connection_id, snapshot_date DESC);
CREATE INDEX idx_subscriptions_cache_connection ON subscriptions_cache(stripe_connection_id);
CREATE INDEX idx_customers_cache_connection ON customers_cache(stripe_connection_id);
CREATE INDEX idx_cohorts_connection_month ON cohorts(stripe_connection_id, cohort_month DESC);

-- RLS Policies
ALTER TABLE stripe_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own connections" ON stripe_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users view own metrics" ON metrics_snapshots
  FOR SELECT USING (
    stripe_connection_id IN (
      SELECT id FROM stripe_connections WHERE user_id = auth.uid()
    )
  );