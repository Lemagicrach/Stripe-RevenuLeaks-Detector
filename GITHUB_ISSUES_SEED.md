# RevPilot – Issue Backlog (Seed)

This file contains a curated list of issues to create in GitHub for RevPilot.
Copy each section into a new GitHub Issue.

---

## Issue 1 – Separate "Pro subscription" (Stripe Billing) from "Stripe Connect" (OAuth)

**Priority:** 🟥 High  
**Labels:** `billing`, `product-logic`, `breaking-ux`, `MVP`

### Description
Currently, the app mixes two very different flows:
- Users paying RevPilot for **Pro/Business plans** (Stripe Billing)
- Users connecting their **own Stripe account** for analytics (Stripe Connect OAuth)

Several CTAs (e.g., “Start Free Trial” or plan buttons) incorrectly send users directly to Stripe Connect instead of a billing/subscription flow. This is confusing and blocks a clear Pro upgrade journey.

We must separate:
1. **RevPilot subscription flow (Stripe Billing)**  
2. **Stripe data connection flow (Stripe Connect)**  

### Tasks
- [ ] Audit all buttons/links that currently point to `/api/stripe/connect`.
- [ ] Define two distinct flows in the UI:
  - [ ] “Upgrade to Pro/Business” → uses Stripe Billing (checkout session).
  - [ ] “Connect Stripe account” → uses Stripe Connect OAuth.
- [ ] Update navigation & pricing page to reflect the separation.
- [ ] Ensure copy clearly explains the difference between “Upgrade plan” and “Connect Stripe”.

### Acceptance Criteria
- A user can:
  - Upgrade to Pro **without** being forced through Stripe Connect.
  - Connect their Stripe account for analytics **without** changing their RevPilot subscription.
- No button labeled “Start Free Trial” or “Upgrade” ever redirects to Stripe Connect OAuth.
- The separation is clearly visible in the UI and code.

---

## Issue 2 – Implement Stripe Checkout for Pro and Business plans

**Priority:** 🟥 High  
**Labels:** `billing`, `stripe`, `backend`, `MVP`

### Description
There is currently no complete Stripe Billing Checkout flow for RevPilot plans. Users see Pro/Business pricing and “Start Free Trial” messaging, but they are not taken through a proper subscription checkout with Stripe Billing.

We need a solid `/api/create-checkout` endpoint that:
- Accepts a selected plan (`pro`, `business`)
- Creates a Stripe Checkout Session using the correct price ID
- Redirects the customer to Stripe Checkout
- Returns the session URL to the frontend

### Tasks
- [ ] Add environment variables:
  - [ ] `STRIPE_PRICE_PRO`
  - [ ] `STRIPE_PRICE_BUSINESS`
- [ ] Create `/api/create-checkout` route:
  - [ ] Validate authenticated user.
  - [ ] Validate `plan` (`pro` | `business`).
  - [ ] Map plan → correct Stripe price ID.
  - [ ] Create Stripe Checkout Session (subscription mode).
  - [ ] Return `{ url: session.url }`.
- [ ] Frontend: call `/api/create-checkout` when user clicks “Upgrade to Pro/Business”.
- [ ] Redirect client to returned `session.url`.
- [ ] Configure Stripe Dashboard:
  - [ ] Set success URL (e.g. `/checkout/success`).
  - [ ] Set cancel URL (e.g. `/checkout/canceled`).

### Acceptance Criteria
- A logged-in user can click “Upgrade to Pro” and be redirected to a real Stripe Checkout subscription flow.
- Test payment results in an active subscription in Stripe.
- No console or server errors during the flow.

---

## Issue 3 – Fix `/api/stripe/connect` to perform an HTTP redirect instead of printing the URL

**Priority:** 🟥 High  
**Labels:** `stripe`, `oauth`, `backend`, `UX`

### Description
The `/api/stripe/connect` endpoint currently returns or prints a raw OAuth URL (e.g., `URL: https://connect.stripe.com/...`). This looks like a debug/sandbox behavior and is not a production-quality UX.

We should make `/api/stripe/connect` issue a proper redirect (`302`) to the Stripe Connect OAuth URL.

### Tasks
- [ ] Update `/api/stripe/connect` to:
  - [ ] Construct the OAuth URL with the required query params.
  - [ ] Use `NextResponse.redirect(url)` in App Router.
- [ ] Ensure response type is not plain text.
- [ ] Add basic error handling and user-friendly error message on failure.

### Acceptance Criteria
- Visiting `/api/stripe/connect` in a browser sends user directly to Stripe Connect OAuth, with no intermediate raw URL page.
- No “URL: …” or debug text is shown to the user.

---

## Issue 4 – Implement robust dashboard state handling (remove infinite "Loading metrics..." state)

**Priority:** 🟥 High  
**Labels:** `frontend`, `UX`, `dashboard`, `MVP`

### Description
The dashboard currently displays “Loading metrics…” without clearly handling different user states:
- Not logged in
- Logged in, but no Stripe connection
- Stripe connection exists but data is still syncing
- Data loaded successfully
- API error

We need clear, explicit UI for each state to avoid confusion and “stuck” feelings.

### Tasks
- [ ] Detect auth state on dashboard:
  - [ ] If not logged in → show login/signup call-to-action.
- [ ] Detect Stripe connection:
  - [ ] If no connection → show “Connect your Stripe account” empty state.
- [ ] Detect data presence:
  - [ ] If connection exists but no data → show “Syncing your data…” message.
  - [ ] If data loaded → render charts and metrics.
- [ ] Handle fetch/API errors:
  - [ ] Show “Something went wrong. Retry” with a button.
- [ ] Replace static “Loading metrics…” with better loading + states.

### Acceptance Criteria
- Different states are visually and functionally distinguishable.
- A new user understands:
  - Why they see what they see.
  - What they need to do next (log in, connect, wait for sync, etc.).
- No user is left stuck on a static “Loading metrics…” screen.

---

## Issue 5 – Fix auth redirect after login/sign-up for upgrade & connect flows

**Priority:** 🟥 High  
**Labels:** `auth`, `routing`, `UX`

### Description
The app needs proper redirect behavior after login/sign-up:

- If a user started from “Upgrade to Pro” → after auth, they should return to the upgrade/checkout flow.
- If from “Connect Stripe” → after auth, they should return to the connect flow.

Currently, redirects may be inconsistent or default to home/dashboard without preserving intent.

### Tasks
- [ ] Add support for `redirectTo`/`returnUrl` query parameter to auth pages.
- [ ] When user clicks:
  - [ ] “Upgrade to Pro” → navigate to `/auth?redirectTo=/upgrade?plan=pro`.
  - [ ] “Connect Stripe” → navigate to `/auth?redirectTo=/connect-stripe`.
- [ ] On successful auth, redirect user to `redirectTo` (or dashboard if absent).
- [ ] Ensure this works both for login and signup flows.

### Acceptance Criteria
- User intent (upgrade vs connect) is preserved across auth.
- Manual tests:
  - Start from upgrade → login → go back to upgrade.
  - Start from connect → login → go back to connect.

---

## Issue 6 – Add onboarding page after signup / subscription success

**Priority:** 🟧 Medium  
**Labels:** `onboarding`, `UX`

### Description
New users arriving after signup or payment need a simple, clear “Next steps” page that explains what to do:

1. Connect Stripe
2. Wait for data sync
3. View metrics

Currently, users can be thrown directly into a dashboard that might be empty or confusing.

### Tasks
- [ ] Create `/onboarding` page.
- [ ] Content:
  - [ ] Short welcome message.
  - [ ] Step list with clear CTAs (Connect Stripe, See Docs, Go to Dashboard).
- [ ] Redirect rules:
  - [ ] After successful signup → `/onboarding`.
  - [ ] After successful Pro checkout → `/onboarding` (with a “You’re Pro now” banner).
- [ ] Optionally allow skipping to dashboard.

### Acceptance Criteria
- New users never land in a “what is this?” empty dashboard.
- Onboarding explains clearly what to do next.

---

## Issue 7 – Configure Stripe webhooks to update `subscription_tier` in Supabase

**Priority:** 🟥 High  
**Labels:** `billing`, `webhooks`, `supabase`, `backend`

### Description
Stripe Billing events must be reflected in Supabase so that user’s `subscription_tier` stays in sync (e.g., `free`, `pro`, `business`).

We need to handle events like:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

And map them to user records.

### Tasks
- [ ] Verify webhook endpoint (e.g. `/api/webhooks/stripe-billing`) is deployed.
- [ ] Parse relevant events.
- [ ] Map event → user by:
  - [ ] customer ID / email / metadata.
- [ ] Update Supabase `user_profiles.subscription_tier` accordingly.
- [ ] Log and handle unknown or unmapped events safely.

### Acceptance Criteria
- After a test Pro checkout:
  - User’s `subscription_tier` in Supabase is set to `pro`.
- After canceling:
  - `subscription_tier` reverts appropriately (`free`/`downgraded`).
- Webhook logs show no uncaught errors.

---

## Issue 8 – Verify and fix database schema (Supabase tables)

**Priority:** 🟧 Medium  
**Labels:** `database`, `supabase`, `schema`

### Description
Errors like `relation "public.profiles" does not exist` indicate schema mismatches between code and database.

We must ensure all required tables and fields exist and align with the codebase, especially:

- `user_profiles` / `profiles`
- `stripe_connections`
- `user_subscriptions`
- `subscription_events`
- `subscriptions_cache`

### Tasks
- [ ] Audit all Supabase queries in the app and list required tables/columns.
- [ ] Compare against actual Supabase schema.
- [ ] Fix or create missing tables:
  - [ ] Prefer consistent name (`user_profiles` or `profiles`, not both).
- [ ] Add required constraints (e.g. foreign keys to user id).
- [ ] Re-run or fix SQL migrations.

### Acceptance Criteria
- No runtime errors about missing relations/tables.
- All tables used in code exist and have correct columns.

---

## Issue 9 – Add manual “Sync subscription state” endpoint for Stripe sessions

**Priority:** 🟧 Medium  
**Labels:** `billing`, `reliability`, `backend`

### Description
If the webhook fails or is delayed, users who just paid might still see “Free” in the app.

We should add a manual sync endpoint, e.g. `/api/sync-stripe-session?session_id=...`, that:

- Fetches session details from Stripe.
- Reconciles subscription state in Supabase.

### Tasks
- [ ] Implement `/api/sync-stripe-session`:
  - [ ] Validate authenticated user.
  - [ ] Fetch session from Stripe by `session_id`.
  - [ ] Find Stripe customer + subscription.
  - [ ] Update user’s `subscription_tier`.
- [ ] Add a “Refresh subscription status” button on success page (optional).

### Acceptance Criteria
- Given a `session_id`, backend can recover and update the correct subscription state even if webhook failed.
- Manual sync fixes inconsistencies between Stripe and Supabase.

---

## Issue 10 – Update pricing page CTAs to match actual behavior

**Priority:** 🟧 Medium  
**Labels:** `copywriting`, `UX`, `frontend`

### Description
The pricing table currently uses “Start Free Trial” CTAs while real behavior is either:
- Free beta (no billing yet), or
- Mixed up with Stripe Connect.

We need clear and accurate CTAs based on actual implemented logic.

### Tasks
- [ ] If billing is NOT live yet:
  - [ ] Use “Connect Stripe — It’s Free” as primary CTA.
  - [ ] Add note “Pricing coming soon; currently free for beta users.”
- [ ] If billing IS live:
  - [ ] Starter → “Connect Stripe — Free”
  - [ ] Pro → “Upgrade to Pro”
  - [ ] Business → “Upgrade to Business”
- [ ] Ensure each button triggers the correct flow (billing vs connect).

### Acceptance Criteria
- No CTA promises behavior that isn’t implemented.
- Users understand clearly what happens when they click.

---

## Issue 11 – Add plan indicator ("Plan: Free / Pro / Business") in the app

**Priority:** 🟨 Low  
**Labels:** `UX`, `frontend`

### Description
Users should always know what plan they’re on inside the app.

Add a small badge or text in the dashboard or header, e.g.:

- “Plan: Free (Beta)”
- “Plan: Pro”
- “Plan: Business”

### Tasks
- [ ] Fetch `subscription_tier` for logged-in user.
- [ ] Render plan label in dashboard header or navbar.
- [ ] Optionally link it to a “Manage billing” / “Change plan” page.

### Acceptance Criteria
- Logged-in users see their current plan clearly.
- Changing subscription updates the displayed plan name.

---

## Issue 12 – Implement core MVP metrics (MRR, active customers, churn, new signups)

**Priority:** 🟧 Medium  
**Labels:** `analytics`, `MVP`, `dashboard`

### Description
To make RevPilot useful as fast as possible, focus on a small set of core metrics:

- Monthly Recurring Revenue (MRR)
- Active customers (current)
- New subscribers (last 30 days)
- Canceled subscribers (last 30 days)
- Basic churn rate

These should be computed from subscription data (preferably cached).

### Tasks
- [ ] Define SQL queries or Supabase views for:
  -
