# Database Setup Instructions

## ⚠️ IMPORTANT: Run This Migration First

Before testing authentication, you **MUST** run the database migration to ensure the user profile trigger is set up correctly.

## Steps to Apply the Migration

### Option 1: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire contents of `supabase/migrations/20250120_fix_signup_trigger.sql`
6. Paste it into the SQL Editor
7. Click **Run** (or press `Cmd+Enter` / `Ctrl+Enter`)
8. Verify you see success messages at the bottom

### Option 2: Using Supabase CLI (If you have it installed)

```bash
# Make sure you're in the project directory
cd /home/user/Stripe-Analytics-SaaS

# Run the migration
supabase db push
```

## What This Migration Does

1. **Adds Missing Columns**: Ensures `user_profiles` table has all required fields:
   - `monthly_ai_insights_limit`
   - `monthly_transaction_volume_limit`

2. **Creates Usage Events Table**: Sets up tracking for user activities

3. **Sets Up Database Trigger**: Creates `handle_new_user()` function that automatically:
   - Creates a user profile when someone signs up
   - Sets default subscription tier to 'starter'
   - Initializes usage limits
   - Handles errors gracefully

4. **Updates Existing Users**: Ensures all current user profiles have the new columns

## Verification

After running the migration, you should see these success messages:

```
✅ Columns exist: 1 AI insights, 1 transaction volume
✅ Trigger exists: 1
✅ Function exists: 1
✅ Database fix completed! Try signing up again.
```

## What's Fixed

### Before (Broken):
- ❌ Signup page manually created profiles → Race condition with trigger
- ❌ Missing columns caused 500 errors
- ❌ Inconsistent data between manual creation and trigger
- ❌ No automatic profile creation on OAuth signup

### After (Fixed):
- ✅ Database trigger automatically creates profiles
- ✅ All required columns exist
- ✅ No more race conditions
- ✅ Works with email/password AND OAuth signup
- ✅ Consistent data structure

## Troubleshooting

### If you get "relation user_profiles does not exist"

You need to create the base table first. Run this in SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  subscription_tier TEXT DEFAULT 'starter',
  subscription_status TEXT DEFAULT 'active',
  monthly_scenario_limit INTEGER DEFAULT 0,
  scenarios_used_this_month INTEGER DEFAULT 0,
  monthly_ai_insights_limit INTEGER DEFAULT 5,
  monthly_transaction_volume_limit INTEGER DEFAULT 10000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Then run the full migration again.

### If you get "permission denied"

Make sure you're running the SQL as the database owner or with sufficient privileges.

## Testing After Migration

1. Try signing up with a new email
2. Check your email for verification link
3. Verify in Supabase Dashboard → Table Editor → user_profiles that:
   - A new profile was created
   - All columns have values
   - No duplicate entries

## Need Help?

If you encounter issues:
1. Check Supabase Dashboard → Logs → Database
2. Look for trigger errors
3. Verify environment variables are set correctly
