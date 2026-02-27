# Stripe Analytics SaaS 📊

> Understand your SaaS metrics instantly. Free alternative to Baremetrics with powerful Stripe analytics, churn prediction, and AI-powered insights.


## Deploy in 1 click (Vercel)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

## Quick Start (Template Mode)

This repo can run in **Template Mode** so your dashboard shows **demo metrics immediately** (perfect for selling as a starter kit).

1. `cp .env.example .env.local`
2. Fill in your Supabase + Stripe keys
3. Ensure `NEXT_PUBLIC_TEMPLATE_MODE=true`
4. `npm install`
5. `npm run dev`
6. Sign up / log in → open `/dashboard` (demo data appears instantly)

To switch from demo → real data:
- Connect Stripe using `/api/stripe/connect`
- Or toggle your data mode in `/admin/settings` (admin allowlist in `ADMIN_EMAILS`)


[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16.0-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

## ✨ Features

- **📈 Real-time Stripe Analytics** - MRR, ARR, churn rate, and more
- **🔄 Subscription Management** - Track subscriptions, upgrades, and cancellations
- **💡 AI-Powered Insights** - Get actionable recommendations powered by AI
- **📊 Advanced Metrics** - LTV, cohort analysis, revenue forecasting
- **🎯 Churn Prevention** - Predict and prevent customer churn
- **📱 Beautiful Dashboard** - Modern, responsive UI built with Next.js
- **🔐 Enterprise Security** - Row-level security, encryption, rate limiting
- **🚀 Production Ready** - Complete with monitoring, error tracking, and CRON jobs

## 🚀 Quick Deploy

Deploy to production in under 30 minutes:

```bash
# 1. Validate your setup
./pre-deploy-check.sh

# 2. Deploy
./deploy.sh

# 3. Follow post-deployment checklist
# See DEPLOY_NOW.md for details
```

**Read the complete guide**: [DEPLOY_NOW.md](./DEPLOY_NOW.md)

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, React 18, TailwindCSS
- **Backend**: Next.js API Routes, Node.js 20
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe
- **Authentication**: Supabase Auth
- **Monitoring**: Sentry
- **Rate Limiting**: Upstash Redis
- **Email**: SendGrid
- **Deployment**: Vercel (recommended)

## 📋 Prerequisites

- Node.js 20.x or higher
- npm or yarn
- Supabase account
- Stripe account (production mode for deployment)
- Vercel account (recommended) or other hosting

## 🏃‍♂️ Local Development

### 1. Clone the repository

```bash
git clone https://github.com/Lemagicrach/Stripe-Analytics-SaaS.git
cd Stripe-Analytics-SaaS
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials. See [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) for details.

### 4. Run database migrations

```bash
# Using Supabase SQL Editor, run:
# - migrations/003_stripe_analytics.sql
# - Other migration files in migrations/
```

### 5. Start development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📚 Documentation

- **[DEPLOY_NOW.md](./DEPLOY_NOW.md)** - Quick deployment guide (START HERE!)
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Detailed deployment guide
- **[PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)** - Pre-deployment checklist
- **[ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)** - Environment variables guide
- **[SECURITY.md](./SECURITY.md)** - Security best practices
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues and solutions
- **[QUICK_START.md](./QUICK_START.md)** - Getting started guide

## 🔐 Security Features

- **Webhook Signature Verification** - All Stripe webhooks verified
- **Row Level Security (RLS)** - Database-level access control
- **AES-256 Encryption** - Sensitive data encrypted at rest
- **Rate Limiting** - API abuse prevention with Upstash Redis
- **CRON Protection** - Secret-based endpoint protection
- **Security Headers** - CSP, XSS protection, and more
- **Environment Secrets** - No hardcoded credentials

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test
npm run test:rls
```

## 🚀 Deployment Scripts

### Pre-Deployment Validation

Checks if your application is ready for deployment:

```bash
./pre-deploy-check.sh
```

Validates:
- ✅ Environment variables (critical and recommended)
- ✅ File structure and dependencies
- ✅ Security configuration
- ✅ Database migrations
- ✅ Git status and secrets

### Automated Deployment

Interactive deployment script:

```bash
./deploy.sh
```

Features:
- Pre-flight checks
- Environment variable validation
- Secret generation
- Test execution
- Production build verification
- Platform selection (Vercel/Docker/Manual)
- Post-deployment checklist

## 📊 Key Metrics Tracked

- **MRR (Monthly Recurring Revenue)** - Real-time revenue tracking
- **ARR (Annual Recurring Revenue)** - Yearly revenue projections
- **Churn Rate** - Customer and revenue churn
- **LTV (Lifetime Value)** - Customer lifetime value
- **ARPU (Average Revenue Per User)** - Revenue per customer
- **Cohort Analysis** - Revenue by customer cohorts
- **Growth Rate** - Month-over-month growth

## 🎯 Subscription Tiers

- **Starter** - $0/month - Basic analytics
- **Professional** - $29/month - Advanced features
- **Business** - $99/month - Full analytics suite
- **Enterprise** - Custom pricing - White-label + priority support

## 🛡️ Environment Variables

### Critical (Required)

```bash
NEXT_PUBLIC_SUPABASE_URL=         # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Supabase anon key
SUPABASE_SERVICE_KEY=             # Supabase service role key
STRIPE_SECRET_KEY=                # Stripe secret key (sk_live_)
STRIPE_WEBHOOK_SECRET=            # Stripe webhook secret
ENCRYPTION_KEY=                   # 64-char hex key for AES-256
CRON_SECRET=                      # Secret for CRON endpoints
NEXT_PUBLIC_APP_URL=              # Your production URL
```

### Recommended

```bash
NEXT_PUBLIC_SENTRY_DSN=           # Error tracking
UPSTASH_REDIS_REST_URL=           # Rate limiting
UPSTASH_REDIS_REST_TOKEN=         # Rate limiting
SENDGRID_API_KEY=                 # Email notifications
```

See [.env.example](./.env.example) for complete list.

## 📦 Project Structure

```
.
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   └── auth/              # Authentication pages
├── components/            # React components
├── lib/                   # Utilities and helpers
├── migrations/            # Database migrations
├── middleware.ts          # Route protection & security
├── deploy.sh             # Deployment script
├── pre-deploy-check.sh   # Pre-deployment validation
└── vercel.json           # Vercel configuration
```

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/Lemagicrach/Stripe-Analytics-SaaS/issues)
- **Documentation**: See docs/ folder
- **Email**: support@example.com (update this)

## 🎯 Roadmap

- [ ] Multi-currency support
- [ ] Advanced forecasting
- [ ] Team collaboration features
- [ ] Mobile app
- [ ] API access
- [ ] Webhooks for custom integrations

## 🌟 Acknowledgments

Built with:
- [Next.js](https://nextjs.org/)
- [Supabase](https://supabase.com/)
- [Stripe](https://stripe.com/)
- [TailwindCSS](https://tailwindcss.com/)
- [Vercel](https://vercel.com/)

---

**Made with ❤️ for SaaS founders**

**Last Updated**: 2025-11-23
