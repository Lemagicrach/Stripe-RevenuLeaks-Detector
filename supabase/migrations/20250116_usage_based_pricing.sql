-- Migration: Usage-Based Pricing System
-- Created: 2025-01-16
-- Description: Implements usage tracking, metering, and billing for RevPilot

-- ============================================================================
-- 1. PRICING PLANS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS pricing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  included_transaction_volume DECIMAL(12,2) NOT NULL, -- Monthly Stripe volume included
  included_ai_insights INTEGER NOT NULL, -- AI queries included per month
  overage_rate_per_10k DECIMAL(10,2) NOT NULL, -- Cost per additional $10K volume
  overage_rate_per_insight DECIMAL(10,2) NOT NULL, -- Cost per additional AI insight
  features JSONB DEFAULT '[]'::jsonb,
  data_retention_days INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default pricing plans
INSERT INTO pricing_plans (plan_name, display_name, base_price, included_transaction_volume, included_ai_insights, overage_rate_per_10k, overage_rate_per_insight, features, data_retention_days, sort_order) VALUES
('free', 'Starter', 0.00, 10000, 5, 0, 0, '["Basic dashboard", "30-day data retention", "Community support"]'::jsonb, 30, 1),
('growth', 'Professional', 29.00, 100000, 50, 5.00, 0.50, '["Full dashboard", "Benchmarking", "1-year data retention", "Email support", "50 AI insights/month"]'::jsonb, 365, 2),
('scale', 'Business', 99.00, 500000, 200, 3.00, 0.40, '["Priority support", "Unlimited data retention", "Custom reports", "200 AI insights/month", "Advanced analytics"]'::jsonb, -1, 3),
('enterprise', 'Enterprise', 299.00, 999999999, 999999, 0, 0, '["Unlimited everything", "Dedicated account manager", "Custom integrations", "SLA guarantees", "White-label options"]'::jsonb, -1, 4);

-- ============================================================================
-- 2. USER SUBSCRIPTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_connection_id UUID REFERENCES stripe_connections(id) ON DELETE SET NULL,
  plan_id UUID NOT NULL REFERENCES pricing_plans(id),
  plan_name VARCHAR(50) NOT NULL, -- Denormalized for quick access
  status VARCHAR(20) DEFAULT 'active', -- active, canceled, past_due, trialing
  current_period_start DATE NOT NULL,
  current_period_end DATE NOT NULL,
  stripe_subscription_id VARCHAR(255), -- For Stripe billing integration
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, current_period_start)
);

-- Index for quick lookups
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);

-- ============================================================================
-- 3. USAGE EVENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_connection_id UUID REFERENCES stripe_connections(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL, -- 'transaction_volume', 'ai_insight', 'api_call'
  amount DECIMAL(12,2), -- For transaction_volume events
  count INTEGER DEFAULT 1, -- For countable events (ai_insight, api_call)
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional context
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_usage_events_user_id ON usage_events(user_id);
CREATE INDEX idx_usage_events_created_at ON usage_events(created_at);
CREATE INDEX idx_usage_events_event_type ON usage_events(event_type);
CREATE INDEX idx_usage_events_user_date ON usage_events(user_id, created_at);

-- ============================================================================
-- 4. MONTHLY USAGE AGGREGATION TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS monthly_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_connection_id UUID REFERENCES stripe_connections(id) ON DELETE SET NULL,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  plan_id UUID NOT NULL REFERENCES pricing_plans(id),
  plan_name VARCHAR(50) NOT NULL,
  
  -- Usage metrics
  transaction_volume DECIMAL(12,2) DEFAULT 0,
  ai_insights_count INTEGER DEFAULT 0,
  api_calls_count INTEGER DEFAULT 0,
  
  -- Billing calculations
  base_charge DECIMAL(10,2) DEFAULT 0,
  transaction_volume_overage DECIMAL(12,2) DEFAULT 0,
  transaction_volume_overage_charge DECIMAL(10,2) DEFAULT 0,
  ai_insights_overage INTEGER DEFAULT 0,
  ai_insights_overage_charge DECIMAL(10,2) DEFAULT 0,
  total_overage_charge DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Metadata
  is_finalized BOOLEAN DEFAULT FALSE,
  finalized_at TIMESTAMP WITH TIME ZONE,
  stripe_invoice_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, billing_period_start)
);

-- Indexes
CREATE INDEX idx_monthly_usage_user_id ON monthly_usage(user_id);
CREATE INDEX idx_monthly_usage_period ON monthly_usage(billing_period_start, billing_period_end);
CREATE INDEX idx_monthly_usage_finalized ON monthly_usage(is_finalized);

-- ============================================================================
-- 5. USAGE TRACKING FUNCTIONS
-- ============================================================================

-- Function to track AI insight usage
CREATE OR REPLACE FUNCTION track_ai_insight_usage(
  p_user_id UUID,
  p_stripe_connection_id UUID,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO usage_events (user_id, stripe_connection_id, event_type, count, metadata)
  VALUES (p_user_id, p_stripe_connection_id, 'ai_insight', 1, p_metadata);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track transaction volume
CREATE OR REPLACE FUNCTION track_transaction_volume(
  p_user_id UUID,
  p_stripe_connection_id UUID,
  p_amount DECIMAL(12,2),
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO usage_events (user_id, stripe_connection_id, event_type, amount, metadata)
  VALUES (p_user_id, p_stripe_connection_id, 'transaction_volume', p_amount, p_metadata);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current month usage for a user
CREATE OR REPLACE FUNCTION get_current_month_usage(p_user_id UUID)
RETURNS TABLE (
  transaction_volume DECIMAL(12,2),
  ai_insights_count INTEGER,
  plan_name VARCHAR(50),
  included_transaction_volume DECIMAL(12,2),
  included_ai_insights INTEGER,
  transaction_volume_remaining DECIMAL(12,2),
  ai_insights_remaining INTEGER,
  is_over_limit BOOLEAN
) AS $$
DECLARE
  v_period_start DATE;
  v_period_end DATE;
  v_subscription RECORD;
BEGIN
  -- Get current billing period
  v_period_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  v_period_end := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  
  -- Get user's current subscription
  SELECT us.plan_name, pp.included_transaction_volume, pp.included_ai_insights
  INTO v_subscription
  FROM user_subscriptions us
  JOIN pricing_plans pp ON us.plan_id = pp.id
  WHERE us.user_id = p_user_id
    AND us.status = 'active'
    AND us.current_period_start <= CURRENT_DATE
    AND us.current_period_end >= CURRENT_DATE
  LIMIT 1;
  
  -- If no active subscription, return zeros
  IF v_subscription IS NULL THEN
    RETURN QUERY SELECT 0::DECIMAL, 0::INTEGER, 'free'::VARCHAR, 10000::DECIMAL, 5::INTEGER, 10000::DECIMAL, 5::INTEGER, FALSE;
    RETURN;
  END IF;
  
  -- Calculate usage
  RETURN QUERY
  SELECT 
    COALESCE(SUM(CASE WHEN ue.event_type = 'transaction_volume' THEN ue.amount ELSE 0 END), 0)::DECIMAL(12,2) AS transaction_volume,
    COALESCE(SUM(CASE WHEN ue.event_type = 'ai_insight' THEN ue.count ELSE 0 END), 0)::INTEGER AS ai_insights_count,
    v_subscription.plan_name,
    v_subscription.included_transaction_volume,
    v_subscription.included_ai_insights,
    GREATEST(v_subscription.included_transaction_volume - COALESCE(SUM(CASE WHEN ue.event_type = 'transaction_volume' THEN ue.amount ELSE 0 END), 0), 0)::DECIMAL(12,2) AS transaction_volume_remaining,
    GREATEST(v_subscription.included_ai_insights - COALESCE(SUM(CASE WHEN ue.event_type = 'ai_insight' THEN ue.count ELSE 0 END), 0), 0)::INTEGER AS ai_insights_remaining,
    (COALESCE(SUM(CASE WHEN ue.event_type = 'ai_insight' THEN ue.count ELSE 0 END), 0) >= v_subscription.included_ai_insights) AS is_over_limit
  FROM usage_events ue
  WHERE ue.user_id = p_user_id
    AND ue.created_at >= v_period_start
    AND ue.created_at <= v_period_end;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate monthly bill
CREATE OR REPLACE FUNCTION calculate_monthly_bill(
  p_user_id UUID,
  p_billing_period_start DATE
)
RETURNS TABLE (
  base_charge DECIMAL(10,2),
  transaction_volume_overage_charge DECIMAL(10,2),
  ai_insights_overage_charge DECIMAL(10,2),
  total_amount DECIMAL(10,2)
) AS $$
DECLARE
  v_period_end DATE;
  v_subscription RECORD;
  v_usage RECORD;
  v_base_charge DECIMAL(10,2);
  v_tv_overage_charge DECIMAL(10,2) := 0;
  v_ai_overage_charge DECIMAL(10,2) := 0;
BEGIN
  v_period_end := (p_billing_period_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  
  -- Get subscription and plan details
  SELECT us.plan_name, pp.base_price, pp.included_transaction_volume, pp.included_ai_insights,
         pp.overage_rate_per_10k, pp.overage_rate_per_insight
  INTO v_subscription
  FROM user_subscriptions us
  JOIN pricing_plans pp ON us.plan_id = pp.id
  WHERE us.user_id = p_user_id
    AND us.current_period_start <= p_billing_period_start
    AND us.current_period_end >= p_billing_period_start
  LIMIT 1;
  
  IF v_subscription IS NULL THEN
    RETURN QUERY SELECT 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL;
    RETURN;
  END IF;
  
  v_base_charge := v_subscription.base_price;
  
  -- Calculate usage
  SELECT 
    COALESCE(SUM(CASE WHEN event_type = 'transaction_volume' THEN amount ELSE 0 END), 0) AS transaction_volume,
    COALESCE(SUM(CASE WHEN event_type = 'ai_insight' THEN count ELSE 0 END), 0) AS ai_insights_count
  INTO v_usage
  FROM usage_events
  WHERE user_id = p_user_id
    AND created_at >= p_billing_period_start
    AND created_at <= v_period_end;
  
  -- Calculate transaction volume overage
  IF v_usage.transaction_volume > v_subscription.included_transaction_volume THEN
    v_tv_overage_charge := CEIL((v_usage.transaction_volume - v_subscription.included_transaction_volume) / 10000) * v_subscription.overage_rate_per_10k;
  END IF;
  
  -- Calculate AI insights overage
  IF v_usage.ai_insights_count > v_subscription.included_ai_insights THEN
    v_ai_overage_charge := (v_usage.ai_insights_count - v_subscription.included_ai_insights) * v_subscription.overage_rate_per_insight;
  END IF;
  
  RETURN QUERY SELECT 
    v_base_charge,
    v_tv_overage_charge,
    v_ai_overage_charge,
    v_base_charge + v_tv_overage_charge + v_ai_overage_charge AS total_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE pricing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_usage ENABLE ROW LEVEL SECURITY;

-- Pricing plans: Public read access
CREATE POLICY "Pricing plans are viewable by everyone"
  ON pricing_plans FOR SELECT
  USING (is_active = TRUE);

-- User subscriptions: Users can view their own
CREATE POLICY "Users can view their own subscriptions"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Usage events: Users can view their own
CREATE POLICY "Users can view their own usage events"
  ON usage_events FOR SELECT
  USING (auth.uid() = user_id);

-- Monthly usage: Users can view their own
CREATE POLICY "Users can view their own monthly usage"
  ON monthly_usage FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- 7. TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
CREATE TRIGGER update_pricing_plans_updated_at BEFORE UPDATE ON pricing_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monthly_usage_updated_at BEFORE UPDATE ON monthly_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. INITIAL USER SUBSCRIPTION SETUP
-- ============================================================================

-- Function to create default free subscription for new users
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_free_plan_id UUID;
BEGIN
  -- Get free plan ID
  SELECT id INTO v_free_plan_id FROM pricing_plans WHERE plan_name = 'free' LIMIT 1;
  
  -- Create free subscription
  INSERT INTO user_subscriptions (user_id, plan_id, plan_name, status, current_period_start, current_period_end)
  VALUES (
    NEW.id,
    v_free_plan_id,
    'free',
    'active',
    CURRENT_DATE,
    (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create subscription on user signup
CREATE TRIGGER on_auth_user_created_create_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_default_subscription();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
