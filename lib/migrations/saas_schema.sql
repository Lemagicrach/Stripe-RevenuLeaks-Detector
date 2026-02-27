-- SaaS-specific tables for PriceDrop
-- These complement your existing API tables

-- User profiles table for SaaS users
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'ultra', 'mega')),
  tracked_count INTEGER DEFAULT 0,
  alerts_count INTEGER DEFAULT 0,
  
  -- Stripe integration
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  subscription_status TEXT,
  current_period_end TIMESTAMPTZ,
  
  -- Usage tracking
  api_calls_this_month INTEGER DEFAULT 0,
  last_api_call TIMESTAMPTZ,
  
  -- Settings
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,
  webhook_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  
  -- Metadata
  referral_source TEXT,
  signup_ip TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team/organization support (for Team plans)
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  plan TEXT DEFAULT 'team' CHECK (plan IN ('team', 'enterprise')),
  
  -- Limits
  max_members INTEGER DEFAULT 5,
  max_products INTEGER DEFAULT 1000,
  
  -- Billing
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  billing_email TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team members
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  
  -- Permissions
  can_add_products BOOLEAN DEFAULT true,
  can_delete_products BOOLEAN DEFAULT false,
  can_manage_alerts BOOLEAN DEFAULT true,
  can_view_analytics BOOLEAN DEFAULT true,
  
  invited_by UUID REFERENCES user_profiles(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(team_id, user_id)
);

-- Subscription history
CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  plan_from TEXT,
  plan_to TEXT,
  change_type TEXT CHECK (change_type IN ('upgrade', 'downgrade', 'cancel', 'resume')),
  stripe_event_id TEXT,
  amount DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API usage logs (for analytics and billing)
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  credits_used INTEGER DEFAULT 1,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved searches/filters
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query JSONB NOT NULL, -- Stores search parameters
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email notification queue
CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referral tracking
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  referred_email TEXT,
  referred_user_id UUID REFERENCES user_profiles(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'signed_up', 'converted', 'expired')),
  referral_code TEXT UNIQUE,
  reward_amount DECIMAL(10, 2),
  reward_type TEXT CHECK (reward_type IN ('credit', 'discount', 'free_month')),
  expires_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics events
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_category TEXT,
  event_data JSONB,
  page_path TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature flags for gradual rollouts
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  allowed_users UUID[] DEFAULT '{}',
  allowed_plans TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer ON user_profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_plan ON user_profiles(plan);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_user ON subscription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_created ON api_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created ON analytics_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name ON analytics_events(event_name);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_saas()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_saas();

DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at 
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_saas();

DROP TRIGGER IF EXISTS update_feature_flags_updated_at ON feature_flags;
CREATE TRIGGER update_feature_flags_updated_at 
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_saas();

-- Function to check user's plan limits
CREATE OR REPLACE FUNCTION check_plan_limits(
  p_user_id UUID,
  p_resource TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_plan TEXT;
  v_tracked_count INTEGER;
  v_limit INTEGER;
BEGIN
  SELECT plan, tracked_count INTO v_plan, v_tracked_count
  FROM user_profiles
  WHERE id = p_user_id;

  IF p_resource = 'products' THEN
    CASE v_plan
      WHEN 'free' THEN v_limit := 5;
      WHEN 'pro' THEN v_limit := 999;
      WHEN 'ultra' THEN v_limit := 999;
      WHEN 'mega' THEN v_limit := 999;
      ELSE v_limit := 5;
    END CASE;
    
    RETURN v_tracked_count < v_limit;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to track API usage
CREATE OR REPLACE FUNCTION track_api_usage(
  p_user_id UUID,
  p_endpoint TEXT,
  p_method TEXT,
  p_status_code INTEGER,
  p_response_time_ms INTEGER
) RETURNS VOID AS $$
BEGIN
  -- Insert usage record
  INSERT INTO api_usage (
    user_id, endpoint, method, status_code, response_time_ms
  ) VALUES (
    p_user_id, p_endpoint, p_method, p_status_code, p_response_time_ms
  );

  -- Update monthly counter
  UPDATE user_profiles
  SET 
    api_calls_this_month = api_calls_this_month + 1,
    last_api_call = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to reset monthly usage (call this via cron)
CREATE OR REPLACE FUNCTION reset_monthly_usage() RETURNS VOID AS $$
BEGIN
  UPDATE user_profiles
  SET api_calls_this_month = 0
  WHERE EXTRACT(DAY FROM NOW()) = 1; -- Reset on the 1st of each month
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own profile" 
  ON user_profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON user_profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can view their team memberships" 
  ON team_members FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their saved searches" 
  ON saved_searches FOR ALL 
  USING (auth.uid() = user_id);

-- Seed data for feature flags
INSERT INTO feature_flags (name, description, enabled, rollout_percentage) VALUES
  ('new_dashboard', 'New dashboard UI', false, 0),
  ('ai_predictions', 'AI-powered price predictions', false, 10),
  ('bulk_import', 'Bulk product import', true, 100),
  ('advanced_analytics', 'Advanced analytics dashboard', false, 50)
ON CONFLICT (name) DO NOTHING;

-- Initial setup complete!
COMMENT ON SCHEMA public IS 'PriceDrop SaaS - Database schema for the web application';
