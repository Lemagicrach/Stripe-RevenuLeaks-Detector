# RevPilot API Routes Deep Audit

## All API Routes Found

1. `/api/admin/clear-connection` - Admin endpoint
2. `/api/benchmarks/compare` - Benchmarking
3. `/api/benchmarks/opt-in` - Benchmarking opt-in
4. `/api/churn/analyze` - Churn analysis
5. `/api/churn/intervene` - Churn intervention
6. `/api/create-checkout` - Payment checkout ✅ FIXED
7. `/api/create-portal` - Stripe customer portal
8. `/api/cron/sync-all` - Cron job sync
9. `/api/health` - Health check
10. `/api/insights` - AI insights
11. `/api/metrics` - Dashboard metrics
12. `/api/scenarios/create` - Scenario planning
13. `/api/stripe/connect-manual` - Manual Stripe connection
14. `/api/stripe/connect` - Stripe OAuth ✅ FIXED
15. `/api/stripe/sync` - Stripe data sync
16. `/api/test-migration` - Test endpoint
17. `/api/track/cron/sync-all` - Tracking cron
18. `/api/usage/current` - Usage tracking
19. `/api/webhooks/stripe-billing` - Stripe webhooks ⚠️ CHECK

## Priority Audit Order

1. **Webhooks** - Critical for payments
2. **Metrics** - Dashboard data
3. **Insights** - AI features
4. **Usage tracking** - Billing
5. **Sync** - Data integrity

---

## Audit Progress

## 🚨 CRITICAL ISSUES SUMMARY

### Issue #1: Webhook Pricing Tier Mapping Incomplete
**Route:** `/api/webhooks/stripe-billing`
**Severity:** 🔴 CRITICAL - Revenue Impact
**Impact:** Professional and Enterprise plan payments succeed but users get Starter tier features

### Issue #2: AI Insights No Usage Tracking
**Route:** `/api/insights`
**Severity:** 🔴 CRITICAL - Revenue Leakage
**Impact:** Users get unlimited AI insights regardless of plan limits

### Issue #3: Usage API Plan Name Mismatch
**Route:** `/api/usage/current`
**Severity:** 🟡 HIGH - Billing Incorrect
**Impact:** Professional/Enterprise users see wrong usage limits and billing

### Issue #4: Connect Route No Auto-Sync
**Route:** `/api/stripe/connect`
**Severity:** 🟡 MEDIUM - UX Issue
**Impact:** Dashboard shows "No data yet" after connection until manual sync

---

## Detailed Findings


### 1. `/api/webhooks/stripe-billing` ⚠️ CRITICAL ISSUES FOUND

**Problems:**

1. **Missing Price IDs** (Lines 20-21)
   ```typescript
   [process.env.STRIPE_REV_PILOT_PRO_PRICE_ID!]: 'pro',
   [process.env.STRIPE_REV_PILOT_BUSINESS_PRICE_ID!]: 'business',
   ```
   - Only maps 2 plans (pro, business)
   - Missing: starter, professional, enterprise
   - Uses OLD env var names
   - Won't recognize new pricing tiers

2. **Tier Mapping Incomplete** (Line 24)
   ```typescript
   return tierMap[priceId] || 'starter'
   ```
   - Defaults to 'starter' for unknown prices
   - Professional plan will be treated as starter!
   - Enterprise plan will be treated as starter!

3. **Scenario Limits Outdated** (Lines 29-36)
   ```typescript
   const limits: Record<string, number | null> = {
     'starter': 0,
     'pro': 3,
     'business': null,
   };
   ```
   - Missing 'professional' and 'enterprise'
   - Not aligned with usage-based pricing model

4. **No Usage-Based Tracking**
   - Webhook doesn't track AI insights usage
   - Doesn't track transaction volume
   - No overage calculation
   - Missing integration with usage tracking system

**Impact:**
- ❌ Payments will succeed but wrong tier assigned
- ❌ Professional plan users get starter features
- ❌ Enterprise plan users get starter features
- ❌ Usage-based billing won't work
- ❌ Overages won't be calculated

**Status:** NEEDS IMMEDIATE FIX

---

### 2. `/api/metrics` ✅ LOOKS GOOD

**Status:** Well-structured, has rate limiting, auto-sync trigger

**Features:**
- ✅ Rate limiting integrated
- ✅ Auto-triggers sync if data >24h old
- ✅ Returns freshness metadata
- ✅ Proper error handling
- ✅ Caching headers

**Potential Issues:**
- None critical - this route looks solid

---

### 3. `/api/insights` ⚠️ MISSING USAGE TRACKING

**Status:** Works but doesn't track usage for billing

**Features:**
- ✅ Rate limiting integrated
- ✅ OpenAI integration working
- ✅ Proper error handling

**Critical Missing:**
- ❌ No usage tracking after generating insights
- ❌ Doesn't increment AI insights counter
- ❌ No integration with usage-based billing
- ❌ Users can exceed limits without being charged

**Impact:**
- Users get unlimited AI insights regardless of plan
- No overage charges calculated
- Revenue leakage

**Fix Required:**
- Add usage tracking after successful insight generation
- Integrate with `lib/usage-tracking.ts`
- Check limits before generating

---

### 4. `/api/usage/current` ⚠️ PLAN NAME MISMATCH

**Status:** Works but has plan name inconsistency

**Features:**
- ✅ Gets current month usage
- ✅ Calculates billing
- ✅ Proper auth check

**Issues Found:**

1. **Hardcoded Plan Names** (Line 41)
   ```typescript
   ['starter', 'pro', 'business'].includes(profile.subscription_tier)
   ```
   - Only recognizes 3 plans: starter, pro, business
   - Missing: professional, enterprise
   - Professional users will default to 'starter'
   - Enterprise users will default to 'starter'

**Impact:**
- ❌ Professional plan users see wrong usage limits
- ❌ Enterprise plan users see wrong usage limits
- ❌ Billing calculations incorrect for new tiers

**Fix Required:**
- Update to include all 4 tiers: starter, professional, business, enterprise
- Align with pricing page naming

---

### 5. `/api/create-checkout` ✅ WELL DONE

**Status:** Excellent - supports all 4 pricing tiers with fallbacks

**Features:**
- ✅ All 4 plans configured (starter, professional, business, enterprise)
- ✅ 'pro' alias for 'professional' (backward compatibility)
- ✅ Fallback env var names for flexibility
- ✅ Proper error handling for missing price IDs
- ✅ Creates Stripe customer if missing
- ✅ Metadata includes all usage limits
- ✅ Auth check integrated

**No issues found** - This is production-ready!

---

### 6. `/api/stripe/sync` ✅ EXCELLENT

**Status:** Well-architected sync system

**Features:**
- ✅ Rate limiting
- ✅ Auth with CRON_SECRET
- ✅ Input validation
- ✅ Supports single or bulk sync
- ✅ GET endpoint for sync status
- ✅ Proper error handling

**No issues found** - Production-ready!

---

### 7. `/api/stripe/connect` ✅ FIXED

**Status:** Previously had duplicate key error - NOW FIXED

**Features:**
- ✅ Uses `.maybeSingle()` instead of `.single()` (line 114)
- ✅ Checks for existing connection before insert
- ✅ Updates existing connection if found
- ✅ Proper encryption of tokens
- ✅ Rate limiting
- ✅ Auth required

**Previous Issue (RESOLVED):**
- ✅ Duplicate key constraint violation - FIXED by checking existing connection first

**Missing Feature:**
- ⚠️ No automatic sync trigger after connection
- Users must manually trigger sync or wait for cron

---

