# RevPilot Deployment Guide - Critical Fixes

## 🚨 URGENT: Deploy These Fixes ASAP

**What was fixed:**
- ✅ Webhook pricing tier mapping (Professional/Enterprise now work)
- ✅ AI insights usage tracking (no more revenue leakage)
- ✅ Usage API plan validation (all 4 tiers supported)
- ✅ Auto-sync after Stripe connection (better UX)

**Impact:** Without these fixes, Professional and Enterprise customers get Starter features!

---

## 📋 Pre-Deployment Checklist

### 1. Configure Stripe Price IDs in Vercel

Go to Vercel Dashboard → Settings → Environment Variables

**Add these variables:**

```bash
# Primary Price IDs (REQUIRED)
STRIPE_STARTER_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_PROFESSIONAL_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_BUSINESS_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_ENTERPRISE_PRICE_ID=price_xxxxxxxxxxxxx
```

**How to get Price IDs:**
1. Go to Stripe Dashboard → Products
2. Click on each product
3. Copy the Price ID (starts with `price_`)
4. Paste into Vercel environment variables

**Note:** The code also supports legacy variable names as fallbacks:
- `STRIPE_REV_PILOT_STARTER_PRICE_ID`
- `STRIPE_REV_PILOT_PRO_PRICE_ID`
- `STRIPE_REV_PILOT_BUSINESS_PRICE_ID`

### 2. Verify Other Environment Variables

**Required variables (should already be set):**

```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
STRIPE_CLIENT_ID=ca_xxxxxxxxxxxxx

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx... (service role key)

# App
NEXT_PUBLIC_APP_URL=https://your-domain.com
CRON_SECRET=your_random_secret_here

# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
```

**Verify in Vercel:**
```bash
vercel env ls
```

### 3. Apply Database Migration

**Option A: Supabase Dashboard (Recommended)**

1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Paste contents of: `supabase/migrations/20250116_usage_based_pricing.sql`
4. Run query
5. Verify success (should see "Success. No rows returned")

**Option B: Supabase CLI**

```bash
supabase db push
```

**Verify migration applied:**

```sql
-- Check if columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
  AND column_name IN ('monthly_ai_insights_limit', 'monthly_transaction_volume_limit');

-- Should return 2 rows
```

### 4. Update Stripe Webhook Configuration

**Go to:** Stripe Dashboard → Developers → Webhooks

**Update endpoint URL:**
```
https://your-domain.com/api/webhooks/stripe-billing
```

**Select these events:**
- ✅ `checkout.session.completed`
- ✅ `customer.subscription.created`
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`
- ✅ `invoice.paid`
- ✅ `invoice.payment_failed`

**Copy webhook signing secret:**
- Click on the webhook endpoint
- Click "Reveal" under "Signing secret"
- Update `STRIPE_WEBHOOK_SECRET` in Vercel

---

## 🚀 Deployment Steps

### Step 1: Deploy to Vercel

**Option A: Automatic (GitHub Integration)**

Changes are already pushed to GitHub. Vercel will auto-deploy.

1. Go to Vercel Dashboard → Deployments
2. Wait for deployment to complete
3. Check deployment logs for errors

**Option B: Manual Deploy**

```bash
cd /path/to/Stripe-Analytics-SaaS
vercel --prod --force
```

The `--force` flag clears build cache to ensure new code is deployed.

### Step 2: Verify Deployment

**Check deployment logs:**

```bash
vercel logs --follow
```

**Look for:**
- ✅ No build errors
- ✅ No TypeScript errors
- ✅ API routes compiled successfully

### Step 3: Clear Vercel Cache (Important!)

If you've deployed before and code seems stale:

1. Go to Vercel Dashboard → Settings
2. Scroll to "Clear Build Cache"
3. Click "Clear Cache"
4. Redeploy

Or via CLI:
```bash
vercel --prod --force
```

---

## 🧪 Testing Checklist

### Test 1: Webhook Configuration ✅

**Test webhook locally (optional):**

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local
stripe listen --forward-to localhost:3000/api/webhooks/stripe-billing

# In another terminal, trigger test event
stripe trigger checkout.session.completed
```

**Expected output:**
```
✅ Checkout completed: sub_xxxxx
📊 Tier: professional, Limits: { scenarioLimit: 3, aiInsightsLimit: 50, ... }
✅ Updated user_profiles for test@example.com to professional tier
```

### Test 2: Complete Customer Journey ✅

**Signup Flow:**
1. ✅ Go to `/signup`
2. ✅ Create new account
3. ✅ Verify email confirmation
4. ✅ Login successful

**Stripe Connection:**
1. ✅ Click "Connect Stripe" button
2. ✅ Complete Stripe OAuth flow
3. ✅ Redirected back to app with `?connected=true`
4. ✅ Check Vercel logs for: `🔄 Triggered background sync for connection: xxx`
5. ✅ Wait 10-30 seconds
6. ✅ Refresh dashboard
7. ✅ **Dashboard should show data** (not "No data yet")

**AI Insights:**
1. ✅ Go to Insights page
2. ✅ Click "Generate Insights"
3. ✅ Insights displayed
4. ✅ Check Vercel logs for: `✅ Tracked AI insight usage for user: xxx`
5. ✅ Go to Usage page
6. ✅ Verify AI insights count incremented

**Upgrade Flow:**
1. ✅ Go to `/pricing`
2. ✅ Click "Upgrade" on Professional plan ($29/month)
3. ✅ Complete Stripe checkout
4. ✅ Redirected back with `?upgraded=true&plan=professional`
5. ✅ Check Vercel logs for webhook events:
   ```
   💰 Checkout completed: sub_xxxxx
   📊 Tier: professional, Limits: {...}
   ✅ Updated user_profiles for user@example.com to professional tier
   ```
6. ✅ Go to Usage page
7. ✅ Verify plan shows "Professional"
8. ✅ Verify limits: 50 AI insights, 100k transactions

### Test 3: Usage Tracking ✅

**Generate multiple insights:**
1. ✅ Generate 3 AI insights
2. ✅ Go to Usage page
3. ✅ Verify count: "3 / 50 AI Insights"
4. ✅ Check database:
   ```sql
   SELECT * FROM usage_events 
   WHERE user_id = 'your-user-id' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

### Test 4: Plan Tier Verification ✅

**Check database directly:**

```sql
-- Get user profile
SELECT 
  user_id,
  email,
  subscription_tier,
  subscription_status,
  monthly_scenario_limit,
  monthly_ai_insights_limit,
  monthly_transaction_volume_limit
FROM user_profiles
WHERE email = 'your-test-email@example.com';
```

**Expected for Professional plan:**
- `subscription_tier`: `professional`
- `subscription_status`: `active`
- `monthly_scenario_limit`: `3`
- `monthly_ai_insights_limit`: `50`
- `monthly_transaction_volume_limit`: `100000`

### Test 5: Enterprise Plan ✅

**Test Enterprise tier:**
1. ✅ Create Stripe checkout for Enterprise plan
2. ✅ Complete payment
3. ✅ Check webhook logs
4. ✅ Verify tier: `enterprise`
5. ✅ Verify limits:
   - Scenarios: `null` (unlimited)
   - AI Insights: `-1` (unlimited)
   - Transaction Volume: `-1` (unlimited)

---

## 🔍 Monitoring & Debugging

### Check Vercel Logs

```bash
# Real-time logs
vercel logs --follow

# Last 100 lines
vercel logs -n 100

# Filter by function
vercel logs --function=api/webhooks/stripe-billing
```

### Check Supabase Logs

1. Go to Supabase Dashboard → Logs
2. Select "Postgres Logs"
3. Filter by table: `user_profiles`, `usage_events`

### Common Issues & Solutions

**Issue: Dashboard shows "No data yet" after connection**

**Solution:**
1. Check if `CRON_SECRET` is set in Vercel
2. Check if `NEXT_PUBLIC_APP_URL` is correct
3. Check Vercel logs for sync trigger:
   ```
   🔄 Triggered background sync for connection: xxx
   ```
4. If not triggered, manually sync:
   ```bash
   curl -X POST https://your-domain.com/api/stripe/sync \
     -H "Authorization: Bearer YOUR_CRON_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"stripeAccountId":"acct_xxx","force":true}'
   ```

**Issue: Professional plan shows as Starter**

**Solution:**
1. Verify `STRIPE_PROFESSIONAL_PRICE_ID` is set correctly in Vercel
2. Check webhook logs for tier mapping:
   ```
   📊 Tier: professional, Limits: {...}
   ```
3. If shows `starter`, price ID doesn't match
4. Get correct price ID from Stripe Dashboard
5. Update environment variable
6. Redeploy

**Issue: AI insights not tracked**

**Solution:**
1. Check Vercel logs for:
   ```
   ✅ Tracked AI insight usage for user: xxx
   ```
2. If not present, check if `trackAIInsight` function exists
3. Verify database migration applied (check `usage_events` table exists)
4. Check Supabase service key has write permissions

**Issue: Webhook signature verification failed**

**Solution:**
1. Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
2. Go to Stripe Dashboard → Webhooks → Click endpoint
3. Click "Reveal" under signing secret
4. Copy and update in Vercel
5. Redeploy

---

## 📊 Success Metrics

After deployment, monitor these metrics:

### Immediate (First Hour)
- ✅ Zero webhook errors in Stripe Dashboard
- ✅ Zero 500 errors in Vercel logs
- ✅ Successful test checkout completion

### Short-term (First Day)
- ✅ All new signups can connect Stripe
- ✅ Dashboards populate automatically
- ✅ Professional/Enterprise plans assigned correctly
- ✅ Usage tracking working

### Medium-term (First Week)
- ✅ No revenue leakage (all AI insights tracked)
- ✅ Correct billing calculations
- ✅ Zero customer support tickets about wrong tier
- ✅ Conversion rate to paid plans increases

---

## 🆘 Rollback Plan

If critical issues occur:

### Option 1: Revert to Previous Deployment

```bash
# Via Vercel Dashboard
1. Go to Deployments
2. Find previous working deployment
3. Click "..." menu
4. Click "Promote to Production"

# Via CLI
vercel rollback
```

### Option 2: Revert Git Commit

```bash
cd /path/to/Stripe-Analytics-SaaS
git revert HEAD
git push origin main
# Vercel will auto-deploy reverted code
```

### Option 3: Emergency Hotfix

If only webhook is broken:

1. Restore backup:
   ```bash
   cd app/api/webhooks/stripe-billing
   cp route.ts.backup route.ts
   git add route.ts
   git commit -m "Rollback webhook to previous version"
   git push origin main
   ```

---

## 📞 Support Contacts

**Stripe Issues:**
- Stripe Dashboard → Help
- https://support.stripe.com

**Vercel Issues:**
- Vercel Dashboard → Help
- https://vercel.com/support

**Supabase Issues:**
- Supabase Dashboard → Support
- https://supabase.com/support

---

## ✅ Post-Deployment Verification

**Run this checklist 24 hours after deployment:**

- [ ] Check Stripe webhook success rate (should be >99%)
- [ ] Verify no error logs in Vercel
- [ ] Check database for correct tier assignments
- [ ] Verify usage tracking working (check `usage_events` table)
- [ ] Test complete customer journey with real payment
- [ ] Monitor customer support tickets (should be zero about wrong tier)
- [ ] Check revenue metrics (no leakage)

---

## 🎉 You're Ready!

All critical fixes are deployed. The system now:
- ✅ Supports all 4 pricing tiers correctly
- ✅ Tracks usage for accurate billing
- ✅ Auto-syncs data after connection
- ✅ Handles errors gracefully
- ✅ Provides smooth customer journey

**Questions?** Check the logs first, then refer to troubleshooting section above.

**Good luck with your launch! 🚀**
