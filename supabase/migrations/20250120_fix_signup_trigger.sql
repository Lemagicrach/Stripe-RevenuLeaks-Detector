-- ============================================================================
-- COMPLETE FIX FOR SIGNUP 500 ERROR
-- Run this entire script in Supabase SQL Editor
-- ============================================================================

-- Step 1: Add missing columns to user_profiles
-- ============================================================================
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS monthly_ai_insights_limit INTEGER DEFAULT 5;

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS monthly_transaction_volume_limit INTEGER DEFAULT 10000;

-- Step 2: Create usage_events table
-- ============================================================================
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  stripe_connection_id UUID,
  event_type VARCHAR(50) NOT NULL,
  amount DECIMAL(12,2),
  count INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_usage_events_user_id ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_event_type ON usage_events(event_type);

-- Step 4: Drop and recreate the user profile trigger function
-- ============================================================================
-- First, drop the existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the old function
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create the new function with all required columns
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (
    user_id,
    email,
    full_name,
    subscription_tier,
    subscription_status,
    monthly_scenario_limit,
    monthly_ai_insights_limit,
    monthly_transaction_volume_limit,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'starter',
    'active',
    0,
    5,
    10000,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error creating user profile: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Recreate the trigger
-- ============================================================================
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 6: Update existing users with default values
-- ============================================================================
UPDATE user_profiles
SET 
  monthly_ai_insights_limit = COALESCE(monthly_ai_insights_limit, 5),
  monthly_transaction_volume_limit = COALESCE(monthly_transaction_volume_limit, 10000),
  subscription_tier = COALESCE(subscription_tier, 'starter'),
  subscription_status = COALESCE(subscription_status, 'active'),
  monthly_scenario_limit = COALESCE(monthly_scenario_limit, 0)
WHERE monthly_ai_insights_limit IS NULL 
   OR monthly_transaction_volume_limit IS NULL;

-- Step 7: Verify the fix
-- ============================================================================
-- Check if columns exist
SELECT 
  'Columns exist: ' || 
  COUNT(*) FILTER (WHERE column_name = 'monthly_ai_insights_limit') || ' AI insights, ' ||
  COUNT(*) FILTER (WHERE column_name = 'monthly_transaction_volume_limit') || ' transaction volume'
  AS status
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
  AND column_name IN ('monthly_ai_insights_limit', 'monthly_transaction_volume_limit');

-- Check if trigger exists
SELECT 
  'Trigger exists: ' || COUNT(*) AS status
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- Check if function exists
SELECT 
  'Function exists: ' || COUNT(*) AS status
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

-- Final success message
SELECT '✅ Database fix completed! Try signing up again.' AS result;
