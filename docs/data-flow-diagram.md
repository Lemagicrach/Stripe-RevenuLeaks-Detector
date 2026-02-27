# RevPilot Data Flow - Complete System Integration

## 🔄 Customer Journey Data Flow

### 1. Signup → Login
```
User → /signup
  ↓
Supabase Auth (creates user)
  ↓
user_profiles table (created via trigger)
  ↓
Default tier: 'starter'
  ↓
User → /login
  ↓
Authenticated session
```

### 2. Stripe Connection (OAuth)
```
User clicks "Connect Stripe"
  ↓
/api/stripe/connect (initiates OAuth)
  ↓
Stripe OAuth flow
  ↓
User authorizes
  ↓
/api/stripe/connect?code=xxx (callback)
  ↓
Exchange code for access_token
  ↓
Save to stripe_connections table
  ├─ stripe_account_id
  ├─ access_token (encrypted)
  ├─ business_name
  └─ currency
  ↓
✅ NEW: Auto-trigger sync
  ↓
/api/stripe/sync (background)
  ↓
Fetch Stripe data:
  ├─ Customers
  ├─ Subscriptions
  ├─ Invoices
  └─ Charges
  ↓
Save to cache tables:
  ├─ customers_cache
  ├─ subscriptions_cache
  └─ metrics_snapshots
  ↓
Dashboard shows data ✅
```

### 3. View Dashboard
```
User → /dashboard
  ↓
/api/metrics?connectionId=xxx
  ↓
Query metrics_snapshots
  ↓
Return:
  ├─ MRR
  ├─ ARR
  ├─ Churn rate
  ├─ Customer count
  └─ Revenue trends
  ↓
Display charts and KPIs
```

### 4. Generate AI Insights
```
User → /insights
  ↓
Click "Generate Insights"
  ↓
/api/insights?connectionId=xxx
  ↓
Fetch metrics_snapshots (last 90 days)
  ↓
Send to OpenAI GPT-4
  ↓
Receive AI analysis:
  ├─ Revenue prediction
  ├─ Churn risk analysis
  ├─ Growth opportunities
  ├─ Pricing suggestions
  └─ Health score
  ↓
✅ NEW: Track usage
  ↓
trackAIInsight(userId, connectionId)
  ↓
Insert into usage_events:
  ├─ user_id
  ├─ event_type: 'ai_insight'
  ├─ stripe_connection_id
  └─ metadata
  ↓
Display insights to user
```

### 5. Check Usage
```
User → /usage
  ↓
/api/usage/current
  ↓
Query user_profiles (get tier)
  ↓
Call getCurrentMonthUsage(userId)
  ↓
Query usage_events (current month):
  ├─ Count ai_insight events
  └─ Sum transaction_volume events
  ↓
Get limits from user_profiles:
  ├─ monthly_ai_insights_limit
  └─ monthly_transaction_volume_limit
  ↓
Calculate remaining:
  ├─ aiInsightsRemaining
  └─ transactionVolumeRemaining
  ↓
Calculate billing:
  ├─ baseCharge (from tier)
  ├─ aiInsightsOverageCharge
  └─ transactionVolumeOverageCharge
  ↓
Display usage meters and billing
```

### 6. Upgrade Plan
```
User → /pricing
  ↓
Click "Upgrade to Professional"
  ↓
/api/create-checkout
  ├─ plan: 'professional'
  └─ userId
  ↓
Create Stripe customer (if needed)
  ↓
Create Stripe checkout session:
  ├─ price: STRIPE_PROFESSIONAL_PRICE_ID
  ├─ customer: cus_xxx
  └─ metadata: { tier: 'professional' }
  ↓
Redirect to Stripe Checkout
  ↓
User completes payment
  ↓
Stripe sends webhook:
  checkout.session.completed
  ↓
/api/webhooks/stripe-billing
  ↓
Verify signature
  ↓
Get subscription details
  ↓
Map priceId → tier
  ├─ STRIPE_PROFESSIONAL_PRICE_ID → 'professional'
  ↓
Get usage limits for tier:
  ├─ scenarioLimit: 3
  ├─ aiInsightsLimit: 50
  └─ transactionVolumeLimit: 100000
  ↓
Update user_profiles:
  ├─ subscription_tier: 'professional'
  ├─ subscription_status: 'active'
  ├─ stripe_customer_id: cus_xxx
  ├─ stripe_subscription_id: sub_xxx
  ├─ monthly_scenario_limit: 3
  ├─ monthly_ai_insights_limit: 50
  └─ monthly_transaction_volume_limit: 100000
  ↓
Insert into user_subscriptions
  ↓
Insert into subscription_events
  ↓
Return 200 OK to Stripe
  ↓
User redirected to /dashboard?upgraded=true
  ↓
Dashboard shows new tier ✅
```

---

## 🗄️ Database Schema

### user_profiles
```sql
user_id                              UUID PRIMARY KEY
email                                TEXT
subscription_tier                    TEXT DEFAULT 'starter'
subscription_status                  TEXT
stripe_customer_id                   TEXT
stripe_subscription_id               TEXT
subscription_current_period_end      TIMESTAMP
monthly_scenario_limit               INTEGER
monthly_ai_insights_limit            INTEGER  -- ✅ NEW
monthly_transaction_volume_limit     INTEGER  -- ✅ NEW
created_at                           TIMESTAMP
updated_at                           TIMESTAMP
```

### usage_events
```sql
id                      UUID PRIMARY KEY
user_id                 UUID REFERENCES user_profiles
event_type              TEXT ('ai_insight' | 'transaction_volume')
stripe_connection_id    UUID
amount                  INTEGER
metadata                JSONB
created_at              TIMESTAMP
```

### stripe_connections
```sql
id                      UUID PRIMARY KEY
user_id                 UUID REFERENCES user_profiles
stripe_account_id       TEXT UNIQUE
access_token_enc        TEXT
refresh_token_enc       TEXT
business_name           TEXT
currency                TEXT
is_active               BOOLEAN
last_synced_at          TIMESTAMP
created_at              TIMESTAMP
updated_at              TIMESTAMP
```

### metrics_snapshots
```sql
id                      UUID PRIMARY KEY
stripe_connection_id    UUID REFERENCES stripe_connections
snapshot_date           DATE
mrr                     DECIMAL
arr                     DECIMAL
total_revenue           DECIMAL
total_customers         INTEGER
active_subscriptions    INTEGER
arpu                    DECIMAL
ltv                     DECIMAL
customer_churn_rate     DECIMAL
revenue_churn_rate      DECIMAL
new_mrr                 DECIMAL
expansion_mrr           DECIMAL
contraction_mrr         DECIMAL
churned_mrr             DECIMAL
reactivation_mrr        DECIMAL
created_at              TIMESTAMP
```

---

## 🔐 API Authentication Flow

### User-Facing APIs (Require Auth)
```
Request → Next.js API Route
  ↓
createClient() from @/lib/supabase/server
  ↓
supabase.auth.getUser()
  ↓
if (!user) → 401 Unauthorized
  ↓
if (user) → Continue with user.id
```

### Webhook APIs (Require Signature)
```
Request → /api/webhooks/stripe-billing
  ↓
Get stripe-signature header
  ↓
stripe.webhooks.constructEvent(body, sig, secret)
  ↓
if (invalid) → 400 Bad Request
  ↓
if (valid) → Process event
```

### Cron/Sync APIs (Require Secret)
```
Request → /api/stripe/sync
  ↓
Get Authorization header
  ↓
if (header !== `Bearer ${CRON_SECRET}`) → 401 Unauthorized
  ↓
if (valid) → Process sync
```

---

## 🎯 Pricing Tier Configuration

### Tier Mapping
```typescript
Price ID                        → Tier Name
────────────────────────────────────────────
STRIPE_STARTER_PRICE_ID         → 'starter'
STRIPE_PROFESSIONAL_PRICE_ID    → 'professional'
STRIPE_BUSINESS_PRICE_ID        → 'business'
STRIPE_ENTERPRISE_PRICE_ID      → 'enterprise'
```

### Usage Limits by Tier
```typescript
Tier          | Scenarios | AI Insights | Transaction Volume | Price
──────────────────────────────────────────────────────────────────────
starter       | 0         | 5           | 10,000            | $0
professional  | 3         | 50          | 100,000           | $29
business      | Unlimited | 200         | 500,000           | $99
enterprise    | Unlimited | Unlimited   | Unlimited         | $299
```

### Overage Pricing
```typescript
// After exceeding included limits
AI Insights:         $1.00 per insight
Transaction Volume:  $0.10 per 1,000 transactions
```

---

## 🔄 Webhook Event Flow

### checkout.session.completed
```
Stripe → Webhook → /api/webhooks/stripe-billing
  ↓
Get subscription from session
  ↓
Retrieve subscription details
  ↓
Get priceId from subscription
  ↓
Map priceId → tier
  ↓
Get limits for tier
  ↓
Find user by email
  ↓
Update user_profiles with:
  ├─ subscription_tier
  ├─ subscription_status
  ├─ stripe_customer_id
  ├─ stripe_subscription_id
  ├─ monthly_scenario_limit
  ├─ monthly_ai_insights_limit
  └─ monthly_transaction_volume_limit
  ↓
Insert into user_subscriptions
  ↓
Insert into subscription_events
  ↓
Return 200 OK
```

### customer.subscription.updated
```
Stripe → Webhook → /api/webhooks/stripe-billing
  ↓
Get subscription from event
  ↓
Get priceId from subscription
  ↓
Map priceId → tier
  ↓
Get limits for tier
  ↓
Find user by stripe_customer_id
  ↓
Update user_profiles with new tier and limits
  ↓
Update user_subscriptions status
  ↓
Insert into subscription_events
  ↓
Return 200 OK
```

### customer.subscription.deleted
```
Stripe → Webhook → /api/webhooks/stripe-billing
  ↓
Get subscription from event
  ↓
Find user by stripe_subscription_id
  ↓
Downgrade to starter:
  ├─ subscription_tier: 'starter'
  ├─ subscription_status: 'canceled'
  ├─ monthly_scenario_limit: 0
  ├─ monthly_ai_insights_limit: 5
  └─ monthly_transaction_volume_limit: 10000
  ↓
Update user_subscriptions status
  ↓
Insert into subscription_events
  ↓
Return 200 OK
```

---

## 🚦 Error Handling

### Database Query Errors
```
Before: .single()
  ↓
Throws error if no rows found
  ↓
Webhook fails ❌

After: .maybeSingle()
  ↓
Returns null if no rows found
  ↓
Check if (data) before proceeding
  ↓
Graceful handling ✅
```

### Upsert Conflicts
```
Before: .upsert(data)
  ↓
Duplicate key error ❌

After: .upsert(data, { onConflict: 'column_name' })
  ↓
Updates existing row
  ↓
No error ✅
```

### Missing Environment Variables
```
process.env.STRIPE_PROFESSIONAL_PRICE_ID || ''
  ↓
If undefined, use empty string
  ↓
Filter out empty keys from tierMap
  ↓
Fallback to 'starter' if not found
  ↓
No crash ✅
```

---

## 📊 Monitoring Points

### Critical Metrics to Monitor

1. **Webhook Success Rate**
   - Target: >99%
   - Alert if: <95%
   - Check: Stripe Dashboard → Webhooks

2. **Sync Success Rate**
   - Target: 100%
   - Alert if: Any failures
   - Check: Vercel logs for "❌ Failed to sync"

3. **Usage Tracking Rate**
   - Target: 100% of AI insights tracked
   - Alert if: Insights generated but not tracked
   - Check: Compare insights API calls vs usage_events count

4. **Tier Assignment Accuracy**
   - Target: 100% correct
   - Alert if: Professional/Enterprise showing as Starter
   - Check: Query user_profiles after webhook events

5. **API Error Rate**
   - Target: <0.1%
   - Alert if: >1%
   - Check: Vercel logs for 500 errors

---

## 🎉 Success Indicators

After deployment, you should see:

✅ **Webhooks**
- All events return 200 OK
- Logs show correct tier mapping
- No signature verification errors

✅ **Usage Tracking**
- Every AI insight has corresponding usage_events row
- Usage page shows accurate counts
- Billing calculations correct

✅ **Auto-Sync**
- Dashboard populates within 30 seconds of connection
- No "No data yet" messages
- Logs show "🔄 Triggered background sync"

✅ **Tier Assignment**
- Professional plan users have tier='professional'
- Limits match pricing page
- Upgrades/downgrades work correctly

✅ **Customer Journey**
- Signup → Connect → View Data → Generate Insights → Upgrade
- All steps complete without errors
- No support tickets about wrong features

---

**This data flow represents the complete, fixed system! 🚀**
