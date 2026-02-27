# Deployment Guide

Complete guide for deploying Stripe Analytics SaaS to production.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- Supabase account and project
- Stripe account (production mode enabled)
- Vercel account (recommended) or other hosting platform
- Upstash Redis account (for rate limiting)
- Sentry account (for error tracking)

## 📋 Step-by-Step Deployment

### 1. Database Setup

#### Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for database provisioning (2-3 minutes)
3. Note your project URL and keys

#### Run Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
psql $DATABASE_URL -f lib/migrations/saas_schema.sql
psql $DATABASE_URL -f migrations/003_stripe_analytics.sql

# Or use Supabase SQL Editor in dashboard
```

#### Verify RLS Policies

Check in Supabase Dashboard > Authentication > Policies that all tables have appropriate RLS policies enabled.

### 2. Stripe Configuration

#### Production API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Switch to **Production mode** (toggle in left sidebar)
3. Get your keys:
   - **API Keys** > Publishable key → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - **API Keys** > Secret key → `STRIPE_SECRET_KEY`

#### Create Products and Prices

```bash
# Using Stripe CLI or Dashboard, create your pricing plans
stripe prices create \
  --unit-amount=999 \
  --currency=usd \
  --recurring[interval]=month \
  --product=prod_xxx
```

Note the price IDs for:
- Pro Monthly → `STRIPE_PRICE_PRO_MONTHLY`
- Ultra Monthly → `STRIPE_PRICE_ULTRA_MONTHLY`
- Mega Monthly → `STRIPE_PRICE_MEGA_MONTHLY`

#### Configure Stripe Connect

1. Go to **Settings** > **Connect** > **Integration**
2. Enable OAuth
3. Add redirect URI: `https://yourdomain.com/api/track/stripe/connect`
4. Note your Client ID → `STRIPE_CLIENT_ID`
5. Set scopes to **read_only**

#### Setup Webhooks

1. Go to **Developers** > **Webhooks**
2. Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy webhook signing secret → `STRIPE_WEBHOOK_SECRET`

### 3. Security Setup

#### Generate Encryption Keys

```bash
# Encryption key for AES-256
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Save as ENCRYPTION_KEY

# CRON secret
openssl rand -base64 32
# Save as CRON_SECRET
```

#### Setup Upstash Redis

1. Go to [upstash.com](https://upstash.com)
2. Create a new Redis database
3. Copy REST URL and token:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

#### Setup Sentry

1. Go to [sentry.io](https://sentry.io)
2. Create new project (Next.js)
3. Copy DSN → `NEXT_PUBLIC_SENTRY_DSN`
4. Create auth token → `SENTRY_AUTH_TOKEN`

### 4. Environment Configuration

Create `.env.production` or configure in your hosting platform:

```bash
# Copy from .env.example
cp .env.example .env.production

# Edit with your production values
nano .env.production
```

**Critical Variables:**
```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_CLIENT_ID=ca_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_ULTRA_MONTHLY=price_xxx
STRIPE_PRICE_MEGA_MONTHLY=price_xxx

# Security
ENCRYPTION_KEY=your-64-char-hex-key
CRON_SECRET=your-cron-secret

# Rate Limiting
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Monitoring
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# App
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production
```

### 5. Deploy to Vercel

#### Using Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Set environment variables
vercel env add ENCRYPTION_KEY production
vercel env add STRIPE_SECRET_KEY production
# ... repeat for all env vars
```

#### Using Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Import Git repository
3. Configure project:
   - Framework: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`
4. Add environment variables in Settings > Environment Variables
5. Deploy

#### Configure Custom Domain

1. Go to Project Settings > Domains
2. Add your domain
3. Configure DNS (A/CNAME records)
4. Wait for SSL certificate provisioning

### 6. Post-Deployment Configuration

#### Test Webhook Endpoint

```bash
# Install Stripe CLI
stripe listen --forward-to https://yourdomain.com/api/webhooks/stripe

# Test webhook
stripe trigger checkout.session.completed
```

#### Update Stripe Webhook URL

1. Go to Stripe Dashboard > Webhooks
2. Update endpoint URL to production domain
3. Test webhook delivery

#### Configure CRON Jobs

Already configured in `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/sync-all",
    "schedule": "0 */6 * * *"
  }]
}
```

Verify in Vercel Dashboard > Settings > Cron Jobs

### 7. Monitoring Setup

#### Sentry Configuration

```bash
# Upload source maps (add to package.json)
"build": "next build && sentry-cli sourcemaps upload --org=your-org --project=your-project .next"
```

#### Health Check

```bash
# Test health endpoint
curl https://yourdomain.com/api/health

# Should return:
{
  "status": "healthy",
  "checks": {
    "database": { "status": "ok", "latency": 45 },
    "env": { "status": "ok" },
    "stripe": { "status": "ok" }
  }
}
```

#### Setup Monitoring Alerts

1. **Vercel**:
   - Project Settings > Monitoring
   - Configure error alerts

2. **Sentry**:
   - Settings > Alerts
   - Configure error rate alerts
   - Set up Slack/email notifications

3. **Uptime Monitoring**:
   - Use external service (UptimeRobot, Pingdom)
   - Monitor `/api/health` endpoint

## 🔧 Alternative Deployment Platforms

### Deploy to Docker

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t stripe-analytics .
docker run -p 3000:3000 --env-file .env.production stripe-analytics
```

### Deploy to AWS

#### Using AWS Amplify

1. Connect GitHub repository
2. Configure build settings
3. Add environment variables
4. Deploy

#### Using EC2 + PM2

```bash
# On EC2 instance
git clone your-repo
cd stripe-analytics
npm install
npm run build

# Install PM2
npm install -g pm2

# Start application
pm2 start npm --name "stripe-analytics" -- start

# Setup auto-restart
pm2 startup
pm2 save
```

### Deploy to Railway

1. Connect GitHub repository
2. Add environment variables
3. Deploy automatically

## 🧪 Testing Production Deployment

### Smoke Tests

```bash
# 1. Health check
curl https://yourdomain.com/api/health

# 2. Test authentication (should redirect to login)
curl -I https://yourdomain.com/dashboard

# 3. Test rate limiting (should return 429 after 100 requests)
for i in {1..101}; do
  curl https://yourdomain.com/api/health
done

# 4. Test webhook (using Stripe CLI)
stripe trigger checkout.session.completed
```

### Load Testing

```bash
# Using Apache Bench
ab -n 1000 -c 10 https://yourdomain.com/api/health

# Using k6
k6 run --vus 10 --duration 30s load-test.js
```

## 🔄 Continuous Deployment

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

## 🚨 Rollback Procedure

### Vercel Instant Rollback

```bash
# List deployments
vercel ls

# Rollback to previous deployment
vercel rollback [deployment-url]
```

### Manual Rollback

```bash
# Revert to previous commit
git revert HEAD
git push

# Or reset to specific commit
git reset --hard <commit-hash>
git push --force
```

## 📊 Performance Optimization

### Enable Caching

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/metrics',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=120',
          },
        ],
      },
    ]
  },
}
```

### Database Optimization

```sql
-- Add indexes for frequently queried fields
CREATE INDEX CONCURRENTLY idx_metrics_date
  ON metrics_snapshots(snapshot_date DESC);

-- Enable connection pooling in Supabase
-- Already enabled by default
```

## 🆘 Troubleshooting

### Common Issues

1. **Build fails on Vercel**
   ```bash
   # Check build logs
   vercel logs

   # Test build locally
   npm run build
   ```

2. **Environment variables not working**
   ```bash
   # Verify in Vercel dashboard
   vercel env ls

   # Re-deploy after adding env vars
   vercel --prod
   ```

3. **Webhooks not receiving**
   - Check webhook URL in Stripe Dashboard
   - Verify STRIPE_WEBHOOK_SECRET matches
   - Test with Stripe CLI

4. **Database connection errors**
   - Check Supabase connection pooler settings
   - Verify RLS policies
   - Check service role key

## 📞 Support

- Documentation: `README.md`
- Security: `SECURITY.md`
- Checklist: `PRODUCTION_CHECKLIST.md`

---

**Last Updated**: November 3, 2024
