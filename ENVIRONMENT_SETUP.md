# RevPilot - Environment Variables Setup Guide

This guide explains how to configure all required environment variables for RevPilot to work properly.

---

## 🔑 Required Environment Variables

### 1. Supabase Configuration

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_role_key_here
```

**How to get these:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Settings → API
4. Copy the values

---

### 2. Stripe Configuration

```bash
# Stripe API Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx  # or pk_live_xxxxx for production
STRIPE_SECRET_KEY=sk_test_xxxxx  # or sk_live_xxxxx for production
STRIPE_CLIENT_ID=ca_xxxxx  # For Stripe Connect OAuth

# Stripe Price IDs (see setup instructions below)
STRIPE_STARTER_PRICE_ID=price_xxxxx
STRIPE_PROFESSIONAL_PRICE_ID=price_xxxxx
STRIPE_BUSINESS_PRICE_ID=price_xxxxx
STRIPE_ENTERPRISE_PRICE_ID=price_xxxxx
```

**How to get API keys:**
1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy Publishable key and Secret key
3. For Connect: Go to Settings → Connect → OAuth settings → Copy Client ID

---

### 3. Stripe Products & Prices Setup

You need to create 4 products in Stripe with recurring prices:

#### Product 1: Starter (Free)
```
Name: RevPilot Starter
Price: $0/month
Billing: Recurring monthly
```

#### Product 2: Professional
```
Name: RevPilot Professional
Price: $29/month
Billing: Recurring monthly
```

#### Product 3: Business
```
Name: RevPilot Business
Price: $99/month
Billing: Recurring monthly
```

#### Product 4: Enterprise
```
Name: RevPilot Enterprise
Price: $299/month
Billing: Recurring monthly
```

**Steps to create:**
1. Go to https://dashboard.stripe.com/test/products
2. Click "+ Add product"
3. Enter name and price
4. Select "Recurring" and "Monthly"
5. Click "Save product"
6. Copy the Price ID (starts with `price_`)
7. Add to environment variables

---

### 4. OpenAI Configuration

```bash
OPENAI_API_KEY=sk-xxxxx
```

**How to get:**
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Copy and save immediately (won't be shown again)

---

### 5. Security Configuration

```bash
# Encryption key for sensitive data (64 character hex string)
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Cron job authentication
CRON_SECRET=your_random_secret_here
```

**How to generate:**
```bash
# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate cron secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 6. Application Configuration

```bash
# App URL (change for production)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Environment
NODE_ENV=production
```

---

## 📋 Complete .env.local Template

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_role_key_here

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_CLIENT_ID=ca_xxxxx

# Stripe Price IDs
STRIPE_STARTER_PRICE_ID=price_xxxxx
STRIPE_PROFESSIONAL_PRICE_ID=price_xxxxx
STRIPE_BUSINESS_PRICE_ID=price_xxxxx
STRIPE_ENTERPRISE_PRICE_ID=price_xxxxx

# OpenAI
OPENAI_API_KEY=sk-xxxxx

# Security
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
CRON_SECRET=your_random_secret_here

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

---

## 🚀 Vercel Deployment Setup

### Add Environment Variables to Vercel:

1. Go to your Vercel project dashboard
2. Click "Settings" → "Environment Variables"
3. Add each variable:
   - Name: Variable name (e.g., `STRIPE_SECRET_KEY`)
   - Value: Your actual value
   - Environment: Select "Production", "Preview", and "Development"
4. Click "Save"

### Important Notes:

- Use **test mode** keys for development and preview
- Use **live mode** keys only for production
- Never commit `.env.local` to git
- Redeploy after adding environment variables

---

## ✅ Verification Checklist

After setting up environment variables, verify:

- [ ] Supabase connection works (check `/dashboard`)
- [ ] Stripe Connect OAuth works (click "Connect Stripe")
- [ ] Payment checkout loads (try upgrading to Professional)
- [ ] AI insights generate (go to `/insights`)
- [ ] Data sync works (check dashboard after connecting Stripe)

---

## 🐛 Troubleshooting

### "Price configuration missing" error
- Check that all `STRIPE_*_PRICE_ID` variables are set
- Verify price IDs start with `price_`
- Ensure prices are set to "Recurring" in Stripe dashboard

### "Unauthorized" errors
- Check Supabase keys are correct
- Verify user is logged in
- Check database permissions

### "Failed to create checkout session"
- Verify Stripe secret key is correct
- Check that price IDs exist in your Stripe account
- Ensure you're using matching test/live mode keys

### AI insights not working
- Verify OpenAI API key is valid
- Check API key has credits
- Look for errors in Vercel function logs

---

## 📞 Need Help?

If you encounter issues:
1. Check Vercel function logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure Stripe products are created properly
4. Test with Stripe test mode first

---

**Last Updated:** November 17, 2025
