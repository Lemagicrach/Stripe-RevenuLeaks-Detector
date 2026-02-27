# Dashboard Pages Installation Guide

This guide shows you how to install the three dashboard pages into your RevPilot project.

## Files Included

1. `churn-page.tsx` - Churn Prevention dashboard page
2. `benchmarks-page.tsx` - Peer Benchmarking dashboard page
3. `scenarios-page.tsx` - Revenue Scenario Planner dashboard page

## Installation Steps

### Step 1: Create Directory Structure

```bash
cd /path/to/revpilot-enhanced

# Create the dashboard subdirectories
mkdir -p app/dashboard/churn
mkdir -p app/dashboard/benchmarks
mkdir -p app/dashboard/scenarios
```

### Step 2: Copy Files to Correct Locations

```bash
# Copy churn page
cp churn-page.tsx app/dashboard/churn/page.tsx

# Copy benchmarks page
cp benchmarks-page.tsx app/dashboard/benchmarks/page.tsx

# Copy scenarios page
cp scenarios-page.tsx app/dashboard/scenarios/page.tsx
```

### Step 3: Verify File Structure

Your project should now have this structure:

```
revpilot-enhanced/
└── app/
    └── dashboard/
        ├── page.tsx                   (existing main dashboard)
        ├── churn/
        │   └── page.tsx               ← NEW
        ├── benchmarks/
        │   └── page.tsx               ← NEW
        └── scenarios/
            └── page.tsx               ← NEW
```

Verify with:

```bash
ls -la app/dashboard/churn/page.tsx
ls -la app/dashboard/benchmarks/page.tsx
ls -la app/dashboard/scenarios/page.tsx
```

## What Each Page Does

### Churn Prevention Page (`app/dashboard/churn/page.tsx`)

**Features:**
- Checks user authentication and redirects to login if needed
- Fetches user's Stripe connection
- Implements feature gating based on subscription tier
- Shows upgrade prompt for Starter tier users
- Renders ChurnPreventionDashboard component for Pro/Business users
- Handles loading states and errors gracefully

**Tier Access:**
- Starter: Upgrade prompt
- Pro: Full access ✓
- Business: Full access ✓

### Peer Benchmarking Page (`app/dashboard/benchmarks/page.tsx`)

**Features:**
- Checks user authentication and redirects to login if needed
- Fetches user's Stripe connection
- Implements feature gating based on subscription tier
- Shows upgrade prompt with example insights for Starter tier users
- Renders PeerBenchmarkingDashboard component for Pro/Business users
- Handles loading states and errors gracefully

**Tier Access:**
- Starter: Upgrade prompt
- Pro: Full access ✓
- Business: Full access ✓

### Revenue Scenarios Page (`app/dashboard/scenarios/page.tsx`)

**Features:**
- Checks user authentication and redirects to login if needed
- Fetches user's Stripe connection
- Implements tiered feature gating
- Shows upgrade prompt for Starter tier users
- Shows limited access notice for Pro tier users (3 scenarios)
- Renders ScenarioPlannerDashboard component with full access for Business users
- Handles loading states and errors gracefully

**Tier Access:**
- Starter: Upgrade prompt
- Pro: Limited access (3 scenarios) ✓
- Business: Full access (unlimited scenarios) ✓

## Configuration Requirements

### 1. User Profiles Table

The pages expect a `user_profiles` table with subscription tier information. If you don't have this yet, create it:

```sql
-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_tier TEXT NOT NULL DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'pro', 'business')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Create index
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
```

### 2. Set Default Tier for Existing Users

```sql
-- Insert profiles for existing users (if needed)
INSERT INTO user_profiles (user_id, subscription_tier)
SELECT id, 'starter' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
```

### 3. Update Subscription Tier

When a user upgrades, update their tier:

```sql
-- Example: Upgrade user to Pro
UPDATE user_profiles 
SET subscription_tier = 'pro', updated_at = NOW()
WHERE user_id = 'user-uuid-here';
```

## Testing the Pages

### Test 1: Access Without Authentication

```bash
# Start dev server
pnpm dev

# Navigate to any page (should redirect to login)
open http://localhost:3000/dashboard/churn
```

**Expected:** Redirect to login page

### Test 2: Access as Starter Tier User

```bash
# Login as a user with 'starter' tier
open http://localhost:3000/dashboard/churn
```

**Expected:** See upgrade prompt with feature benefits

### Test 3: Access as Pro Tier User

```bash
# Login as a user with 'pro' tier
open http://localhost:3000/dashboard/churn
```

**Expected:** See full dashboard

### Test 4: Access Without Stripe Connection

```bash
# Login as a user without Stripe connection
open http://localhost:3000/dashboard/churn
```

**Expected:** See "Connect Your Stripe Account" prompt

## Customization

### Change Pricing

Update the pricing information in the upgrade prompts:

```typescript
// In each page file, find:
<p className="text-sm text-gray-500 mt-6">
  Pro plan starts at $29/month • Cancel anytime
</p>

// Change to your actual pricing
```

### Change Tier Logic

Modify the feature gating logic:

```typescript
// In each page file, find:
if (userTier === 'starter') {
  // Show upgrade prompt
}

// Modify to match your tier structure
```

### Change Color Schemes

Each page uses a different primary color:
- Churn: Purple (`purple-600`)
- Benchmarks: Blue (`blue-600`)
- Scenarios: Green (`green-600`)

Change these throughout the file to match your brand.

### Add Analytics

Track page views and upgrade prompt interactions:

```typescript
// Add to each page's useEffect
useEffect(() => {
  // Track page view
  analytics.track('Dashboard Page Viewed', {
    page: 'churn', // or 'benchmarks', 'scenarios'
    tier: userTier
  })
}, [userTier])

// Track upgrade button clicks
onClick={() => {
  analytics.track('Upgrade Prompt Clicked', {
    from_page: 'churn',
    current_tier: userTier
  })
  router.push('/pricing')
}}
```

## Error Handling

The pages handle three error states:

1. **No Connection**: User hasn't connected Stripe
2. **Load Error**: Database or API error
3. **Authentication Error**: User not logged in (redirects)

All errors show user-friendly messages with retry options.

## Loading States

Each page shows a loading spinner while:
- Checking authentication
- Fetching user profile
- Fetching Stripe connection

This prevents flashing content and improves UX.

## Accessibility

The pages include:
- Semantic HTML structure
- Keyboard navigation support
- Screen reader friendly text
- High contrast colors
- Clear error messages

## Performance

The pages use:
- Client-side rendering for dynamic content
- Supabase client-side queries
- Lazy loading of dashboard components
- Efficient state management

## Security

The pages implement:
- Server-side authentication checks
- RLS policies on database queries
- Feature gating based on subscription tier
- No sensitive data in client code

## Troubleshooting

### Issue: "user_profiles table does not exist"

**Solution:** Run the SQL to create the user_profiles table (see Configuration Requirements above)

### Issue: Page shows loading forever

**Solution:** Check browser console for errors. Likely a Supabase connection issue.

### Issue: Always shows upgrade prompt

**Solution:** Verify user's subscription_tier in database:

```sql
SELECT user_id, subscription_tier FROM user_profiles WHERE user_id = 'your-user-id';
```

### Issue: "Cannot find module '@/components/...'"

**Solution:** Verify the dashboard components exist:

```bash
ls -la components/churn/churn-prevention-dashboard.tsx
ls -la components/benchmarks/peer-benchmarking-dashboard.tsx
ls -la components/scenarios/scenario-planner-dashboard.tsx
```

## Next Steps

After installing the pages:

1. **Update Navigation**: Add links to these pages in your main navigation
2. **Test Each Tier**: Create test users for each subscription tier
3. **Customize Branding**: Update colors, text, and pricing to match your brand
4. **Add Analytics**: Track page views and conversion events
5. **Monitor Performance**: Check page load times and optimize if needed

## Support

If you encounter issues:

1. Check the browser console for errors
2. Verify database tables exist
3. Check Supabase connection
4. Review the IMPLEMENTATION_ROADMAP.md for context
5. Test with different user tiers

---

**Installation complete!** Your three dashboard pages are now ready to use.
