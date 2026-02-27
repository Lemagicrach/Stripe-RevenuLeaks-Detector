-- Migration: Usage-Based Pricing System (FIXED)
-- Created: 2025-01-20
-- Description: Implements usage tracking, metering, and billing for RevPilot
-- FIX: Uses INSERT ... ON CONFLICT to avoid duplicate key errors

-- ============================================================================
-- 1. ADD COLUMNS TO user_profiles (if not exists)
-- ============================================================================
DO $$ 
BEGIN
  -- Add monthly_ai_insights_limit column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' 
    AND column_name = 'monthly_ai_insights_limit'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN monthly_ai_insights_limit INTEGER DEFAULT 5;
  END IF;

  -- Add monthly_transaction_volume_limit column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' 
    AND column_name = 'monthly_transaction_volume_limit'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN monthly_transaction_volume_limit INTEGER DEFAULT 10000;
  END IF;
END $$;

-- ============================================================================
-- 2. USAGE EVENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  stripe_connection_id UUID,
  event_type VARCHAR(50) NOT NULL, -- 'transaction_volume', 'ai_insight', 'api_call'
  amount DECIMAL(12,2), -- For transaction_volume events
  count INTEGER DEFAULT 1, -- For countable events (ai_insight, api_call)
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional context
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying (create only if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_usage_events_user_id') THEN
    CREATE INDEX idx_usage_events_user_id ON usage_events(user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_usage_events_created_at') THEN
    CREATE INDEX idx_usage_events_created_at ON usage_events(created_at);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_usage_events_event_type') THEN
    CREATE INDEX idx_usage_events_event_type ON usage_events(event_type);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_usage_events_user_date') THEN
    CREATE INDEX idx_usage_events_user_date ON usage_events(user_id, created_at);
  END IF;
END $$;

-- ============================================================================
-- 3. USAGE TRACKING FUNCTIONS
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
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to track AI insight: %', SQLERRM;
    RETURN FALSE;
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
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to track transaction volume: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current month usage for a user
CREATE OR REPLACE FUNCTION get_current_month_usage(p_user_id UUID)
RETURNS TABLE (
  transaction_volume DECIMAL(12,2),
  ai_insights_count INTEGER,
  plan_name VARCHAR(50),
  included_transaction_volume INTEGER,
  included_ai_insights INTEGER,
  transaction_volume_remaining INTEGER,
  ai_insights_remaining INTEGER,
  is_over_limit BOOLEAN
) AS $$
DECLARE
  v_period_start TIMESTAMP;
  v_period_end TIMESTAMP;
  v_profile RECORD;
BEGIN
  -- Get current billing period (month)
  v_period_start := DATE_TRUNC('month', NOW());
  v_period_end := DATE_TRUNC('month', NOW()) + INTERVAL '1 month';
  
  -- Get user's profile with limits
  SELECT 
    COALESCE(subscription_tier, 'starter') AS plan_name,
    COALESCE(monthly_transaction_volume_limit, 10000) AS included_transaction_volume,
    COALESCE(monthly_ai_insights_limit, 5) AS included_ai_insights
  INTO v_profile
  FROM user_profiles
  WHERE user_id = p_user_id;
  
  -- If no profile found, return defaults
  IF v_profile IS NULL THEN
    RETURN QUERY SELECT 
      0::DECIMAL(12,2), 
      0::INTEGER, 
      'starter'::VARCHAR, 
      10000::INTEGER, 
      5::INTEGER, 
      10000::INTEGER, 
      5::INTEGER, 
      FALSE;
    RETURN;
  END IF;
  
  -- Calculate usage for current month
  RETURN QUERY
  SELECT 
    COALESCE(SUM(CASE WHEN ue.event_type = 'transaction_volume' THEN ue.amount ELSE 0 END), 0)::DECIMAL(12,2) AS transaction_volume,
    COALESCE(SUM(CASE WHEN ue.event_type = 'ai_insight' THEN ue.count ELSE 0 END), 0)::INTEGER AS ai_insights_count,
    v_profile.plan_name::VARCHAR,
    v_profile.included_transaction_volume::INTEGER,
    v_profile.included_ai_insights::INTEGER,
    GREATEST(v_profile.included_transaction_volume - COALESCE(SUM(CASE WHEN ue.event_type = 'transaction_volume' THEN ue.amount ELSE 0 END), 0), 0)::INTEGER AS transaction_volume_remaining,
    GREATEST(v_profile.included_ai_insights - COALESCE(SUM(CASE WHEN ue.event_type = 'ai_insight' THEN ue.count ELSE 0 END), 0), 0)::INTEGER AS ai_insights_remaining,
    (COALESCE(SUM(CASE WHEN ue.event_type = 'ai_insight' THEN ue.count ELSE 0 END), 0) >= v_profile.included_ai_insights)::BOOLEAN AS is_over_limit
  FROM usage_events ue
  WHERE ue.user_id = p_user_id
    AND ue.created_at >= v_period_start
    AND ue.created_at < v_period_end;
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
  v_profile RECORD;
  v_usage RECORD;
  v_base_charge DECIMAL(10,2);
  v_tv_overage_charge DECIMAL(10,2) := 0;
  v_ai_overage_charge DECIMAL(10,2) := 0;
  v_overage_rate_tv DECIMAL(10,2) := 0.10; -- $0.10 per 1,000 transactions
  v_overage_rate_ai DECIMAL(10,2) := 1.00; -- $1.00 per insight
BEGIN
  v_period_end := (p_billing_period_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  
  -- Get user profile and limits
  SELECT 
    COALESCE(subscription_tier, 'starter') AS plan_name,
    COALESCE(monthly_transaction_volume_limit, 10000) AS included_transaction_volume,
    COALESCE(monthly_ai_insights_limit, 5) AS included_ai_insights
  INTO v_profile
  FROM user_profiles
  WHERE user_id = p_user_id;
  
  IF v_profile IS NULL THEN
    RETURN QUERY SELECT 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL;
    RETURN;
  END IF;
  
  -- Determine base charge by tier
  v_base_charge := CASE v_profile.plan_name
    WHEN 'starter' THEN 0
    WHEN 'professional' THEN 29
    WHEN 'business' THEN 99
    WHEN 'enterprise' THEN 299
    ELSE 0
  END;
  
  -- Calculate usage
  SELECT 
    COALESCE(SUM(CASE WHEN event_type = 'transaction_volume' THEN amount ELSE 0 END), 0) AS transaction_volume,
    COALESCE(SUM(CASE WHEN event_type = 'ai_insight' THEN count ELSE 0 END), 0) AS ai_insights_count
  INTO v_usage
  FROM usage_events
  WHERE user_id = p_user_id
    AND created_at >= p_billing_period_start::TIMESTAMP
    AND created_at <= v_period_end::TIMESTAMP;
  
  -- Calculate transaction volume overage (skip for enterprise)
  IF v_profile.plan_name != 'enterprise' AND v_usage.transaction_volume > v_profile.included_transaction_volume THEN
    v_tv_overage_charge := CEIL((v_usage.transaction_volume - v_profile.included_transaction_volume) / 1000) * v_overage_rate_tv;
  END IF;
  
  -- Calculate AI insights overage (skip for enterprise)
  IF v_profile.plan_name != 'enterprise' AND v_usage.ai_insights_count > v_profile.included_ai_insights THEN
    v_ai_overage_charge := (v_usage.ai_insights_count - v_profile.included_ai_insights) * v_overage_rate_ai;
  END IF;
  
  RETURN QUERY SELECT 
    v_base_charge,
    v_tv_overage_charge,
    v_ai_overage_charge,
    (v_base_charge + v_tv_overage_charge + v_ai_overage_charge)::DECIMAL(10,2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. UPDATE EXISTING USER PROFILES WITH DEFAULT LIMITS
-- ============================================================================
UPDATE user_profiles
SET 
  monthly_ai_insights_limit = CASE subscription_tier
    WHEN 'starter' THEN 5
    WHEN 'professional' THEN 50
    WHEN 'business' THEN 200
    WHEN 'enterprise' THEN -1
    ELSE 5
  END,
  monthly_transaction_volume_limit = CASE subscription_tier
    WHEN 'starter' THEN 10000
    WHEN 'professional' THEN 100000
    WHEN 'business' THEN 500000
    WHEN 'enterprise' THEN -1
    ELSE 10000
  END
WHERE monthly_ai_insights_limit IS NULL 
   OR monthly_transaction_volume_limit IS NULL;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$ 
BEGIN
  RAISE NOTICE '✅ Usage-based pricing migration completed successfully!';
  RAISE NOTICE '📊 Added columns: monthly_ai_insights_limit, monthly_transaction_volume_limit';
  RAISE NOTICE '📋 Created table: usage_events';
  RAISE NOTICE '🔧 Created functions: track_ai_insight_usage, track_transaction_volume, get_current_month_usage, calculate_monthly_bill';
END $$;
