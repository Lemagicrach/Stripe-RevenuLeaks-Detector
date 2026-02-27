# Troubleshooting Guide

## Common Deployment Errors

### 1. "Unexpected end of JSON input" Error on Dashboard

**Cause:** The dashboard is trying to fetch metrics from `/api/metrics`, but either:
- No Stripe connection has been established yet
- The API is returning an error that's not valid JSON
- Environment variables are missing

**Solution:**
1. First, connect your Stripe account by clicking "Get Started" or visiting `/api/stripe/connect`
2. Complete the OAuth flow with Stripe
3. Wait for the initial data sync to complete
4. Then navigate to the dashboard

### 2. HTTP 500 Error on `/api/stripe/connect`

**Cause:** Missing or misconfigured environment variables required for the OAuth flow.

**Required Environment Variables:**
```
STRIPE_CLIENT_ID=ca_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
ENCRYPTION_KEY=your-64-character-hex-key
```

**How to Fix:**
1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add all required variables from `.env.example`
4. Redeploy your application

### 3. Missing `autoprefixer` or `postcss-nested` Module

**Cause:** Build dependencies are not properly installed.

**Solution:**
```bash
npm install -D autoprefixer postcss postcss-nested
git add package.json package-lock.json
git commit -m "fix: add missing PostCSS dependencies"
git push
```

## Setup Checklist

### Prerequisites
- [ ] Stripe account (test mode is fine for development)
- [ ] Supabase project created
- [ ] Vercel account for deployment

### Step 1: Stripe Configuration

1. **Get Stripe API Keys:**
   - Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
   - Copy your "Publishable key" → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - Copy your "Secret key" → `STRIPE_SECRET_KEY`

2. **Create Stripe Connect Application:**
   - Go to [Stripe Connect Settings](https://dashboard.stripe.com/settings/applications)
   - Click "Get Started" or "Create Application"
   - Fill in application details:
     - Name: "RevPilot" (or your app name)
     - Redirect URI: `https://your-domain.vercel.app/api/stripe/connect`
   - Copy the "Client ID" → `STRIPE_CLIENT_ID`

3. **Create Webhook:**
   - Go to [Stripe Webhooks](https://dashboard.stripe.com/test/webhooks)
   - Click "Add endpoint"
   - Endpoint URL: `https://your-domain.vercel.app/api/webhooks/stripe-billing`
   - Select events: `customer.subscription.*`, `invoice.*`, `charge.*`
   - Copy "Signing secret" → `STRIPE_WEBHOOK_SECRET`

### Step 2: Supabase Configuration

1. **Create Supabase Project:**
   - Go to [Supabase Dashboard](https://app.supabase.com)
   - Create a new project
   - Wait for database to be provisioned

2. **Get Supabase Keys:**
   - Go to Project Settings → API
   - Copy "Project URL" → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy "anon public" key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy "service_role" key → `SUPABASE_SERVICE_KEY` (⚠️ Keep this secret!)

3. **Run Database Migrations:**
   - The migrations in `/migrations` folder need to be run
   - Go to Supabase SQL Editor
   - Run each migration file in order

### Step 3: Generate Security Keys

1. **Generate Encryption Key:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Copy output → `ENCRYPTION_KEY`

2. **Generate CRON Secret:**
   ```bash
   openssl rand -base64 32
   ```
   Copy output → `CRON_SECRET`

### Step 4: Configure Vercel

1. **Deploy to Vercel:**
   ```bash
   npm install -g vercel
   vercel
   ```

2. **Add Environment Variables:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add all variables from the checklist above
   - Make sure to add them for "Production", "Preview", and "Development" environments

3. **Update Stripe Redirect URI:**
   - After first deployment, copy your Vercel URL
   - Go back to Stripe Connect Settings
   - Update the Redirect URI to: `https://your-vercel-url.vercel.app/api/stripe/connect`

4. **Redeploy:**
   - After adding environment variables, trigger a new deployment
   - Either push a new commit or use "Redeploy" button in Vercel

### Step 5: Optional Services (Recommended for Production)

1. **Upstash Redis (Rate Limiting):**
   - Sign up at [Upstash](https://upstash.com)
   - Create a Redis database
   - Copy REST URL → `UPSTASH_REDIS_REST_URL`
   - Copy REST Token → `UPSTASH_REDIS_REST_TOKEN`

2. **Sentry (Error Tracking):**
   - Sign up at [Sentry](https://sentry.io)
   - Create a new project
   - Copy DSN → `NEXT_PUBLIC_SENTRY_DSN`

## Testing Your Deployment

### 1. Test Landing Page
- Visit your Vercel URL
- Should see the RevPilot landing page
- No errors in browser console

### 2. Test Stripe OAuth Flow
- Click "Get Started" button
- Should redirect to Stripe OAuth page
- After authorizing, should redirect back to your app with success message

### 3. Test Dashboard
- After connecting Stripe, visit `/dashboard`
- Should see metrics (may be $0 if no data yet)
- No "Unexpected end of JSON input" error

## Common Issues and Solutions

### Issue: "supabaseUrl is required" Error

**Solution:** The `NEXT_PUBLIC_SUPABASE_URL` environment variable is missing or not properly set in Vercel.

1. Check that the variable name is exactly `NEXT_PUBLIC_SUPABASE_URL` (case-sensitive)
2. Make sure it starts with `https://`
3. Redeploy after adding the variable

### Issue: "ENCRYPTION_KEY environment variable is required"

**Solution:** Generate and add the encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add the output to Vercel environment variables as `ENCRYPTION_KEY`.

### Issue: OAuth Redirect Mismatch

**Error:** "redirect_uri_mismatch" from Stripe

**Solution:**
1. Check that your Stripe Connect application has the correct redirect URI
2. The URI should be: `https://your-exact-vercel-url.vercel.app/api/stripe/connect`
3. Make sure there are no trailing slashes
4. The protocol must be `https://` in production

### Issue: Database Tables Don't Exist

**Error:** "relation does not exist" or similar database errors

**Solution:**
1. Run all migration files in `/migrations` folder
2. Go to Supabase SQL Editor
3. Execute each `.sql` file in order
4. Verify tables exist in Table Editor

### Issue: Rate Limit Errors

**Error:** "Unable to find environment variable: UPSTASH_REDIS_REST_URL"

**Solution:** This is a warning, not a critical error. The app will work without Redis, but rate limiting will be disabled. For production, set up Upstash Redis as described above.

## Getting Help

If you're still experiencing issues:

1. Check the Vercel deployment logs for detailed error messages
2. Check the browser console for client-side errors
3. Verify all environment variables are set correctly
4. Make sure database migrations have been run
5. Test with Stripe in test mode first before going to production

## Environment Variables Quick Reference

### Critical (Required)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_CLIENT_ID`
- `NEXT_PUBLIC_APP_URL`
- `ENCRYPTION_KEY`

### Important (Recommended)
- `STRIPE_WEBHOOK_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `CRON_SECRET`

### Optional (Nice to Have)
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENDGRID_API_KEY`
- `EMAIL_FROM`
