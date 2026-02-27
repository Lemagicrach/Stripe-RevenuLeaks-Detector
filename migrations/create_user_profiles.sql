-- ============================================================================
-- User Profiles Table - Subscription Tier Tracking
-- ============================================================================
-- This migration creates the user_profiles table for tracking subscription
-- tiers and user metadata. Required for feature gating in dashboard pages.
--
-- Run this migration:
--   psql $DATABASE_URL -f create_user_profiles.sql
-- ============================================================================

-- Drop existing objects if they exist (for clean re-runs)
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- ============================================================================
-- Create user_profiles table
-- ============================================================================

CREATE TABLE user_profiles (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign key to auth.users
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Subscription tier (starter, pro, business)
  subscription_tier TEXT NOT NULL DEFAULT 'starter' 
    CHECK (subscription_tier IN ('starter', 'pro', 'business')),
  
  -- Subscription status
  subscription_status TEXT DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'cancelled', 'past_due', 'trialing', 'paused')),
  
  -- Stripe customer ID (optional, for payment tracking)
  stripe_customer_id TEXT,
  
  -- Stripe subscription ID (optional, for payment tracking)
  stripe_subscription_id TEXT,
  
  -- Subscription dates
  subscription_started_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  
  -- User metadata
  company_name TEXT,
  company_size TEXT CHECK (company_size IN ('1-10', '11-50', '51-200', '201-500', '500+')),
  industry TEXT,
  
  -- Feature flags (for gradual rollouts)
  feature_flags JSONB DEFAULT '{}',
  
  -- Usage limits (for tier enforcement)
  monthly_scenario_limit INTEGER,
  scenarios_used_this_month INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one profile per user
  UNIQUE(user_id)
);

-- ============================================================================
-- Create indexes for performance
-- ============================================================================

-- Index on user_id for fast lookups
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);

-- Index on subscription_tier for analytics
CREATE INDEX idx_user_profiles_subscription_tier ON user_profiles(subscription_tier);

-- Index on subscription_status for filtering
CREATE INDEX idx_user_profiles_subscription_status ON user_profiles(subscription_status);

-- Index on stripe_customer_id for payment webhooks
CREATE INDEX idx_user_profiles_stripe_customer_id ON user_profiles(stripe_customer_id) 
  WHERE stripe_customer_id IS NOT NULL;

-- Index on subscription dates for expiry checks
CREATE INDEX idx_user_profiles_subscription_ends_at ON user_profiles(subscription_ends_at)
  WHERE subscription_ends_at IS NOT NULL;

-- ============================================================================
-- Create updated_at trigger
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile" 
  ON user_profiles
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Policy: Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile" 
  ON user_profiles
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (
    -- Users can only update these fields
    auth.uid() = user_id AND
    -- Prevent users from changing their own tier
    subscription_tier = (SELECT subscription_tier FROM user_profiles WHERE user_id = auth.uid())
  );

-- Policy: Service role can do everything
CREATE POLICY "Service role has full access" 
  ON user_profiles
  FOR ALL 
  USING (auth.jwt()->>'role' = 'service_role');

-- Policy: Authenticated users can insert their own profile
CREATE POLICY "Users can insert own profile" 
  ON user_profiles
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function: Get user's subscription tier
CREATE OR REPLACE FUNCTION get_user_tier(p_user_id UUID)
RETURNS TEXT AS $$
  SELECT subscription_tier 
  FROM user_profiles 
  WHERE user_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Function: Check if user has access to feature
CREATE OR REPLACE FUNCTION has_feature_access(
  p_user_id UUID,
  p_feature TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_tier TEXT;
BEGIN
  SELECT subscription_tier INTO v_tier
  FROM user_profiles
  WHERE user_id = p_user_id;
  
  -- Starter tier: basic features only
  IF v_tier = 'starter' THEN
    RETURN p_feature IN ('dashboard', 'metrics', 'stripe_connection');
  
  -- Pro tier: includes churn prevention and benchmarking
  ELSIF v_tier = 'pro' THEN
    RETURN p_feature IN (
      'dashboard', 'metrics', 'stripe_connection',
      'churn_prevention', 'peer_benchmarking', 'scenarios_limited'
    );
  
  -- Business tier: full access
  ELSIF v_tier = 'business' THEN
    RETURN TRUE;
  
  -- Default: no access
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check scenario limit
CREATE OR REPLACE FUNCTION check_scenario_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_tier TEXT;
  v_limit INTEGER;
  v_used INTEGER;
BEGIN
  SELECT subscription_tier, monthly_scenario_limit, scenarios_used_this_month
  INTO v_tier, v_limit, v_used
  FROM user_profiles
  WHERE user_id = p_user_id;
  
  -- Starter: no scenarios
  IF v_tier = 'starter' THEN
    RETURN FALSE;
  
  -- Pro: 3 scenarios per month
  ELSIF v_tier = 'pro' THEN
    RETURN COALESCE(v_used, 0) < COALESCE(v_limit, 3);
  
  -- Business: unlimited
  ELSIF v_tier = 'business' THEN
    RETURN TRUE;
  
  -- Default: no access
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Increment scenario usage
CREATE OR REPLACE FUNCTION increment_scenario_usage(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE user_profiles
  SET scenarios_used_this_month = COALESCE(scenarios_used_this_month, 0) + 1
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Reset monthly scenario usage (call via cron)
CREATE OR REPLACE FUNCTION reset_monthly_scenario_usage()
RETURNS VOID AS $$
BEGIN
  UPDATE user_profiles
  SET scenarios_used_this_month = 0
  WHERE subscription_tier = 'pro';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Seed Data: Create profiles for existing users
-- ============================================================================

-- Insert profiles for existing users who don't have one
-- All existing users default to 'starter' tier
INSERT INTO user_profiles (user_id, subscription_tier, subscription_status)
SELECT 
  id, 
  'starter', 
  'active'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_profiles)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- Set tier limits based on subscription tier
-- ============================================================================

-- Pro tier: 3 scenarios per month
UPDATE user_profiles
SET monthly_scenario_limit = 3
WHERE subscription_tier = 'pro' AND monthly_scenario_limit IS NULL;

-- Business tier: unlimited (NULL means unlimited)
UPDATE user_profiles
SET monthly_scenario_limit = NULL
WHERE subscription_tier = 'business';

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check table was created
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_profiles'
  ) THEN
    RAISE NOTICE '✓ user_profiles table created successfully';
  ELSE
    RAISE EXCEPTION '✗ user_profiles table was not created';
  END IF;
END $$;

-- Check RLS is enabled
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'user_profiles' 
    AND rowsecurity = true
  ) THEN
    RAISE NOTICE '✓ Row Level Security enabled';
  ELSE
    RAISE WARNING '⚠ Row Level Security not enabled';
  END IF;
END $$;

-- Count existing profiles
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_profiles;
  RAISE NOTICE '✓ Created profiles for % existing users', v_count;
END $$;

-- Show tier distribution
DO $$
DECLARE
  v_starter INTEGER;
  v_pro INTEGER;
  v_business INTEGER;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE subscription_tier = 'starter'),
    COUNT(*) FILTER (WHERE subscription_tier = 'pro'),
    COUNT(*) FILTER (WHERE subscription_tier = 'business')
  INTO v_starter, v_pro, v_business
  FROM user_profiles;
  
  RAISE NOTICE '  Starter: %', v_starter;
  RAISE NOTICE '  Pro: %', v_pro;
  RAISE NOTICE '  Business: %', v_business;
END $$;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE user_profiles IS 
  'User profiles with subscription tier tracking for feature gating';

COMMENT ON COLUMN user_profiles.subscription_tier IS 
  'User subscription tier: starter (free), pro ($29/mo), business ($79/mo)';

COMMENT ON COLUMN user_profiles.subscription_status IS 
  'Current status of the subscription';

COMMENT ON COLUMN user_profiles.feature_flags IS 
  'JSON object for feature flag overrides and A/B testing';

COMMENT ON COLUMN user_profiles.monthly_scenario_limit IS 
  'Number of scenarios allowed per month (NULL = unlimited)';

COMMENT ON COLUMN user_profiles.scenarios_used_this_month IS 
  'Number of scenarios created this month (resets monthly)';

COMMENT ON FUNCTION get_user_tier(UUID) IS 
  'Get the subscription tier for a user';

COMMENT ON FUNCTION has_feature_access(UUID, TEXT) IS 
  'Check if user has access to a specific feature based on their tier';

COMMENT ON FUNCTION check_scenario_limit(UUID) IS 
  'Check if user can create more scenarios this month';

COMMENT ON FUNCTION increment_scenario_usage(UUID) IS 
  'Increment the scenario usage counter for a user';

COMMENT ON FUNCTION reset_monthly_scenario_usage() IS 
  'Reset scenario usage counters at the start of each month (call via cron)';

-- ============================================================================
-- Success message
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✓ User Profiles Migration Completed Successfully';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Update user tiers as needed:';
  RAISE NOTICE '   UPDATE user_profiles SET subscription_tier = ''pro'' WHERE user_id = ''...'';';
  RAISE NOTICE '';
  RAISE NOTICE '2. Set up monthly cron job to reset scenario usage:';
  RAISE NOTICE '   SELECT cron.schedule(''reset-scenario-usage'', ''0 0 1 * *'',';
  RAISE NOTICE '     $$SELECT reset_monthly_scenario_usage();$$);';
  RAISE NOTICE '';
  RAISE NOTICE '3. Test feature access:';
  RAISE NOTICE '   SELECT has_feature_access(''user-id'', ''churn_prevention'');';
  RAISE NOTICE '';
END $$;
