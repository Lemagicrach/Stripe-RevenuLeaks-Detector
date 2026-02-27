# RevPilot Quick Reference Card

## 🚨 Critical Environment Variables

Copy these to Vercel → Settings → Environment Variables:

```bash
# Stripe Price IDs (GET FROM STRIPE DASHBOARD)
STRIPE_STARTER_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_PROFESSIONAL_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_BUSINESS_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_ENTERPRISE_PRICE_ID=price_xxxxxxxxxxxxx

# Stripe Keys
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
STRIPE_CLIENT_ID=ca_xxxxxxxxxxxxx

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx...

# App
NEXT_PUBLIC_APP_URL=https://your-domain.com
CRON_SECRET=your_random_secret_here

# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
```

---

## 📋 Deployment Checklist

- [ ] 1. Add Stripe Price IDs to Vercel
- [ ] 2. Apply database migration in Supabase
- [ ] 3. Update Stripe webhook endpoint URL
- [ ] 4. Deploy to Vercel (auto or `vercel --prod --force`)
- [ ] 5. Clear Vercel build cache
- [ ] 6. Test signup → connect → dashboard → insights → upgrade
- [ ] 7. Verify webhook logs show correct tier
- [ ] 8. Check usage tracking working

---

## 🔍 Quick Debugging

### Dashboard shows "No data yet"
```bash
# Check if sync triggered
vercel logs | grep "Triggered background sync"

# Manual sync
curl -X POST https://your-domain.com/api/stripe/sync \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"stripeAccountId":"acct_xxx","force":true}'
```

### Professional plan shows as Starter
```bash
# Check webhook logs
vercel logs | grep "Tier:"

# Should show: "📊 Tier: professional, Limits: {...}"
# If shows "starter", check STRIPE_PROFESSIONAL_PRICE_ID
```

### AI insights not tracked
```bash
# Check logs
vercel logs | grep "Tracked AI insight"

# Should show: "✅ Tracked AI insight usage for user: xxx"
```

### Webhook signature failed
```bash
# Verify secret matches
stripe webhooks list
# Copy signing secret
# Update STRIPE_WEBHOOK_SECRET in Vercel
# Redeploy
```

---

## 📊 Pricing Tiers Quick Reference

| Tier | Price | Scenarios | AI Insights | Transactions |
|------|-------|-----------|-------------|--------------|
| Starter | $0 | 0 | 5 | 10K |
| Professional | $29 | 3 | 50 | 100K |
| Business | $99 | ∞ | 200 | 500K |
| Enterprise | $299 | ∞ | ∞ | ∞ |

---

## 🔗 Important URLs

- **Stripe Dashboard:** https://dashboard.stripe.com
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Supabase Dashboard:** https://supabase.com/dashboard
- **GitHub Repo:** https://github.com/Lemagicrach/Stripe-Analytics-SaaS

---

## 🆘 Emergency Commands

### Rollback deployment
```bash
vercel rollback
```

### View real-time logs
```bash
vercel logs --follow
```

### Test webhook locally
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe-billing
stripe trigger checkout.session.completed
```

### Check database
```sql
-- Get user tier
SELECT email, subscription_tier, monthly_ai_insights_limit 
FROM user_profiles 
WHERE email = 'test@example.com';

-- Check usage events
SELECT event_type, COUNT(*) 
FROM usage_events 
WHERE user_id = 'xxx' 
  AND created_at >= date_trunc('month', NOW())
GROUP BY event_type;
```

---

## ✅ Success Indicators

After deployment, verify:

- ✅ Webhook success rate >99% (Stripe Dashboard)
- ✅ Zero 500 errors (Vercel logs)
- ✅ Dashboard populates after connection
- ✅ Professional plan users have correct limits
- ✅ AI insights tracked in usage_events table
- ✅ Upgrade flow completes successfully

---

## 📞 Get Help

- **Stripe:** https://support.stripe.com
- **Vercel:** https://vercel.com/support
- **Supabase:** https://supabase.com/support

---

**Keep this handy during deployment! 🚀**
