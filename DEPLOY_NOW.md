# 🚀 Quick Deployment Guide

This guide will get your Stripe Analytics SaaS application deployed to production in under 30 minutes.

## 📋 Prerequisites

Before you start, ensure you have:

- [ ] **Node.js 20.x** installed
- [ ] **Git** repository set up
- [ ] **Supabase account** with a production project
- [ ] **Stripe account** in production mode
- [ ] **Vercel account** (recommended) or other hosting
- [ ] **Upstash account** for Redis (optional but recommended)
- [ ] **Sentry account** for error tracking (optional but recommended)

## 🎯 Quick Start (3 Steps)

### Step 1: Pre-Deployment Validation

Run the validation script to check if everything is ready:

```bash
./pre-deploy-check.sh
```

This will check:
- ✅ Environment variables
- ✅ File structure
- ✅ Dependencies
- ✅ Security configuration
- ✅ Git status

**If you see errors**, fix them before proceeding to Step 2.

### Step 2: Run Deployment Script

```bash
./deploy.sh
```

This script will:
1. Run pre-flight checks
2. Validate environment variables
3. Generate missing secrets
4. Run tests
5. Test production build
6. Deploy to your chosen platform

Follow the interactive prompts to:
- Configure missing environment variables
- Choose deployment platform (Vercel/Docker/Manual)
- Commit changes if needed

### Step 3: Post-Deployment Configuration

After deployment, complete these critical steps:

#### 3.1 Database Setup

Run migrations in your production Supabase:

```bash
# Get your database URL from Supabase dashboard
psql $DATABASE_URL -f migrations/003_stripe_analytics.sql

# Or use Supabase SQL Editor and paste the migration files
```

#### 3.2 Stripe Configuration

1. **Get Production Keys**
   - Go to [Stripe Dashboard](https://dashboard.stripe.com)
   - Switch to **Production** mode
   - Copy API keys to your environment variables

2. **Configure Webhook**
   - Go to **Developers → Webhooks**
   - Add endpoint: `https://yourdomain.com/api/webhooks/stripe-billing`
   - Select events:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`
     - `invoice.payment_failed`
   - Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

3. **Test Webhook**
   ```bash
   # Using Stripe CLI
   stripe listen --forward-to https://yourdomain.com/api/webhooks/stripe-billing
   stripe trigger checkout.session.completed
   ```

#### 3.3 Verify Deployment

Test these endpoints:

```bash
# Health check
curl https://yourdomain.com/api/health

# Should return:
# {
#   "status": "healthy",
#   "checks": {
#     "database": { "status": "ok" },
#     "env": { "status": "ok" },
#     "stripe": { "status": "ok" }
#   }
# }
```

## 🔐 Environment Variables Cheat Sheet

### Must Have (Critical)

Generate these if you haven't:

```bash
# ENCRYPTION_KEY (64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# CRON_SECRET
openssl rand -base64 32
```

Copy from your dashboards:

```bash
# Supabase (from project settings)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_KEY=eyJxxx...

# Stripe (from dashboard - PRODUCTION mode)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_CLIENT_ID=ca_xxxxx

# Price IDs (from Stripe products)
STRIPE_STARTER_PRICE_ID=price_xxxxx
STRIPE_PROFESSIONAL_PRICE_ID=price_xxxxx
STRIPE_BUSINESS_PRICE_ID=price_xxxxx
STRIPE_ENTERPRISE_PRICE_ID=price_xxxxx

# App
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production
```

### Highly Recommended

```bash
# Error tracking
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx

# Rate limiting
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxxx

# Email notifications
SENDGRID_API_KEY=SG.xxxxx
EMAIL_FROM=noreply@yourdomain.com
```

## 🎨 Platform-Specific Instructions

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Add environment variables
vercel env add ENCRYPTION_KEY production
# Repeat for all variables...
```

**Or use Vercel Dashboard:**
1. Import GitHub repository
2. Add environment variables in Settings → Environment Variables
3. Deploy

### Docker

```bash
# Build image
docker build -t stripe-analytics:latest .

# Run
docker run -p 3000:3000 --env-file .env.production stripe-analytics:latest

# Or use docker-compose
docker-compose up -d
```

### Railway / Render / Others

1. Connect GitHub repository
2. Set build command: `npm run build`
3. Set start command: `npm start`
4. Add environment variables
5. Deploy

## ✅ Post-Deployment Checklist

After deploying, verify:

- [ ] Health endpoint returns 200: `https://yourdomain.com/api/health`
- [ ] User can sign up
- [ ] User can sign in
- [ ] Stripe Connect flow works
- [ ] Subscription checkout works
- [ ] Webhooks are being received (check Stripe Dashboard)
- [ ] Sentry is receiving events
- [ ] CRON jobs are scheduled (Vercel Dashboard)

## 🐛 Troubleshooting

### Build Fails

```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Environment Variables Not Working

```bash
# In Vercel
vercel env ls
vercel env pull .env.local

# Re-deploy after adding env vars
vercel --prod --force
```

### Database Connection Issues

- Check Supabase connection string
- Verify service role key
- Check RLS policies are enabled
- Verify IP allowlist in Supabase (if configured)

### Webhooks Not Working

- Verify webhook URL in Stripe Dashboard
- Check webhook secret matches
- Test with Stripe CLI
- Check logs in your hosting platform

## 📞 Need Help?

- **Documentation**: See `DEPLOYMENT.md` for detailed guide
- **Checklist**: See `PRODUCTION_CHECKLIST.md` for complete checklist
- **Security**: See `SECURITY.md` for security best practices
- **Troubleshooting**: See `TROUBLESHOOTING.md` for common issues

## 🎉 Success!

Once everything is green:

1. **Monitor** your application in the first 24 hours
2. **Check** Sentry for any errors
3. **Verify** webhook delivery in Stripe
4. **Test** all critical user flows
5. **Celebrate** 🎊 - you're live!

---

**Created**: 2025-11-23
**Last Updated**: 2025-11-23
**Maintained By**: Development Team
