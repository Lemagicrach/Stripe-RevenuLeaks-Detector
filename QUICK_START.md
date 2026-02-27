# Quick Start Guide - RevPilot (Stripe Analytics SaaS)

## 🚀 Get Your App Running in 10 Minutes

This guide will help you fix the current deployment errors and get your Stripe Analytics SaaS up and running.

## Current Issues

Based on the errors you're seeing:

1. ❌ **Dashboard showing "Unexpected end of JSON input"**
   - Cause: No Stripe connection established yet + missing environment variables

2. ❌ **HTTP 500 error on "Get Started" button**
   - Cause: Missing Stripe OAuth configuration in Vercel

## Fix Steps

### Step 1: Set Up Stripe Connect (5 minutes)

1. **Go to Stripe Dashboard:**
   - Visit: https://dashboard.stripe.com/settings/applications
   - Click "Create Application" or "Get Started"

2. **Fill in Application Details:**
   - **Application Name:** RevPilot (or your preferred name)
   - **Redirect URI:** `https://your-vercel-url.vercel.app/api/stripe/connect`
     - Replace `your-vercel-url` with your actual Vercel deployment URL
     - Example: `https://stripe-analytics-saas-git-main-yazans-projects.vercel.app/api/stripe/connect`

3. **Save and Copy Client ID:**
   - After creating, copy the "Client ID" (starts with `ca_`)
   - Keep this for Step 3

### Step 2: Get Your Stripe Secret Key (1 minute)

1. Go to: https://dashboard.stripe.com/test/apikeys
2. Copy your "Secret key" (starts with `sk_test_`)
3. Keep this for Step 3

### Step 3: Set Up Supabase (3 minutes)

If you haven't already:

1. **Create Supabase Project:**
   - Go to: https://app.supabase.com
   - Click "New Project"
   - Fill in project details and wait for provisioning

2. **Get Supabase Credentials:**
   - Go to Project Settings → API
   - Copy these values:
     - Project URL (starts with `https://`)
     - `anon` public key (starts with `eyJ`)
     - `service_role` key (starts with `eyJ`)

3. **Run Database Migrations:**
   - Go to Supabase SQL Editor
   - Run each `.sql` file from the `/migrations` folder in your repository
   - Execute them in order (by filename)

### Step 4: Generate Encryption Key (30 seconds)

Run this command in your terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output (a 64-character string).

### Step 5: Add Environment Variables to Vercel (2 minutes)

1. **Go to Vercel Dashboard:**
   - Open your project
   - Click "Settings" → "Environment Variables"

2. **Add These Variables:**

   **Critical Variables (Required):**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
   SUPABASE_SERVICE_KEY=eyJxxx...
   STRIPE_SECRET_KEY=sk_test_xxx...
   STRIPE_CLIENT_ID=ca_xxx...
   NEXT_PUBLIC_APP_URL=https://your-vercel-url.vercel.app
   ENCRYPTION_KEY=your-64-char-hex-key-from-step-4
   ```

   **Important Variables (Highly Recommended):**
   ```
   CRON_SECRET=any-random-string-here
   ```

   **Optional Variables (Can add later):**
   ```
   UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
   UPSTASH_REDIS_REST_TOKEN=xxx
   NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
   ```

3. **Apply to All Environments:**
   - Make sure to check "Production", "Preview", and "Development"

### Step 6: Redeploy (1 minute)

1. **Option A - Push a new commit:**
   ```bash
   git commit --allow-empty -m "trigger redeploy"
   git push
   ```

2. **Option B - Use Vercel Dashboard:**
   - Go to "Deployments" tab
   - Click the three dots on the latest deployment
   - Click "Redeploy"

### Step 7: Test Your Application (2 minutes)

1. **Visit Your Vercel URL:**
   - Should see the landing page without errors

2. **Click "Get Started" Button:**
   - Should redirect to Stripe OAuth page
   - Authorize the connection
   - Should redirect back to your app with success message

3. **Visit Dashboard:**
   - Go to `/dashboard`
   - Should see metrics (may be $0 if no transactions yet)
   - No more "Unexpected end of JSON input" error

## Verification Checklist

After completing the steps above, verify:

- [ ] Landing page loads without errors
- [ ] "Get Started" button redirects to Stripe OAuth (no 500 error)
- [ ] After connecting Stripe, you're redirected back successfully
- [ ] Dashboard loads and shows metrics (even if $0)
- [ ] No console errors in browser DevTools

## Common Mistakes to Avoid

1. **Wrong Redirect URI Format:**
   - ❌ `http://your-url` (should be `https://`)
   - ❌ `https://your-url/` (no trailing slash)
   - ✅ `https://your-url.vercel.app/api/stripe/connect`

2. **Environment Variable Names:**
   - Variable names are case-sensitive
   - Must include `NEXT_PUBLIC_` prefix for client-side variables
   - Double-check spelling

3. **Supabase Keys:**
   - Don't confuse `anon` key with `service_role` key
   - `service_role` key should NEVER be exposed to the client
   - Make sure you're using the correct project URL

4. **Encryption Key:**
   - Must be exactly 64 hexadecimal characters
   - Generate using the command provided, don't make one up

## What If It Still Doesn't Work?

### Check Vercel Logs:
1. Go to Vercel Dashboard → Your Project → Deployments
2. Click on the latest deployment
3. Click "View Function Logs"
4. Look for error messages

### Check Browser Console:
1. Open your deployed site
2. Press F12 (or Cmd+Option+I on Mac)
3. Go to "Console" tab
4. Look for red error messages

### Common Error Messages:

**"supabaseUrl is required"**
- Missing `NEXT_PUBLIC_SUPABASE_URL` in Vercel
- Make sure it starts with `https://`

**"redirect_uri_mismatch"**
- Stripe Connect redirect URI doesn't match
- Update in Stripe Dashboard to match your Vercel URL exactly

**"ENCRYPTION_KEY environment variable is required"**
- Missing or invalid encryption key
- Generate a new one with the command in Step 4

## Need More Help?

See the full [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) guide for detailed solutions to common issues.

## Next Steps After Setup

Once your app is running:

1. **Test with Stripe Test Mode:**
   - Create test subscriptions in Stripe Dashboard
   - Run the sync to pull data
   - Verify metrics appear correctly

2. **Set Up Webhooks:**
   - Go to Stripe Dashboard → Webhooks
   - Add endpoint: `https://your-url.vercel.app/api/webhooks/stripe-billing`
   - Select events: `customer.subscription.*`, `invoice.*`

3. **Add Optional Services:**
   - Upstash Redis for rate limiting
   - Sentry for error tracking
   - SendGrid for email notifications

4. **Go Live:**
   - Switch from Stripe test mode to live mode
   - Update all Stripe keys in Vercel
   - Test the full flow again

## Summary

The main issues were:
1. Missing Stripe OAuth configuration (`STRIPE_CLIENT_ID`)
2. Missing Supabase configuration
3. Missing encryption key
4. No Stripe connection established yet

Following this guide should resolve all current errors and get your app fully functional!
