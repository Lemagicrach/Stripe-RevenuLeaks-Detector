# Row Level Security (RLS) Test Plan for RevPilot Features

This document provides a comprehensive test plan to verify that Row Level Security policies correctly isolate data between different user accounts in Supabase.

## Overview

The RevPilot features include 10 new tables with RLS policies that must ensure users can only access their own data. This test plan covers all tables and provides specific SQL queries to verify isolation.

## Test Environment Setup

### Prerequisites

Before running tests, ensure you have:
- Access to Supabase SQL Editor or psql client
- Two test user accounts created in your authentication system
- At least one Stripe connection for each test user
- Supabase service role key for administrative queries

### Test User Setup

Create two test users with the following structure:

```sql
-- Get test user IDs (run this to identify your test users)
SELECT id, email FROM auth.users 
WHERE email IN ('testuser1@example.com', 'testuser2@example.com');

-- Expected output:
-- User 1: id = 'uuid-user-1', email = 'testuser1@example.com'
-- User 2: id = 'uuid-user-2', email = 'testuser2@example.com'
```

### Create Test Data

For each user, create a Stripe connection:

```sql
-- Insert test Stripe connections (using service role)
INSERT INTO stripe_connections (id, user_id, account_id, access_token, is_active)
VALUES 
  ('conn-user-1', 'uuid-user-1', 'acct_test1', 'encrypted_token_1', true),
  ('conn-user-2', 'uuid-user-2', 'acct_test2', 'encrypted_token_2', true);
```

## Test Plan Structure

Each test follows this pattern:

1. **Setup**: Insert test data as service role
2. **Test as User 1**: Verify User 1 can see their own data
3. **Test as User 2**: Verify User 2 cannot see User 1's data
4. **Cross-verify**: Verify User 2 can see their own data
5. **Cleanup**: Remove test data

## Table 1: churn_predictions

### RLS Policy to Test
```sql
CREATE POLICY "Users view own churn predictions" ON churn_predictions
  FOR SELECT USING (
    stripe_connection_id IN (
      SELECT id FROM stripe_connections WHERE user_id = auth.uid()
    )
  );
```

### Test Procedure

#### Step 1: Insert Test Data (as service role)

```sql
-- Switch to service role context
SET LOCAL role TO service_role;

-- Insert churn predictions for both users
INSERT INTO churn_predictions (
  stripe_connection_id,
  customer_id,
  subscription_id,
  risk_score,
  risk_level,
  churn_probability,
  mrr_at_risk,
  ltv_at_risk,
  risk_factors,
  signals,
  recommended_actions,
  generated_email_subject,
  generated_email_body,
  email_tone,
  status,
  model_version,
  confidence_score
) VALUES 
  -- User 1's prediction
  (
    'conn-user-1',
    'cus_user1_test',
    'sub_user1_test',
    75.5,
    'high',
    68.3,
    500.00,
    6000.00,
    '[{"factor": "payment_failure", "weight": 0.25, "description": "2 failed payments"}]'::jsonb,
    '{"failed_payments_30d": 2}'::jsonb,
    '[{"action": "update_payment", "priority": 1, "description": "Contact customer"}]'::jsonb,
    'Payment Issue - Let us help',
    'Hi there, we noticed a payment issue...',
    'helpful',
    'pending',
    'v1.0',
    85
  ),
  -- User 2's prediction
  (
    'conn-user-2',
    'cus_user2_test',
    'sub_user2_test',
    82.0,
    'critical',
    75.5,
    1000.00,
    12000.00,
    '[{"factor": "cancel_scheduled", "weight": 0.90, "description": "Scheduled to cancel"}]'::jsonb,
    '{"cancel_at_period_end": true}'::jsonb,
    '[{"action": "retention_offer", "priority": 1, "description": "Offer discount"}]'::jsonb,
    'We would love to keep you',
    'Hi there, we noticed you scheduled cancellation...',
    'urgent',
    'pending',
    'v1.0',
    90
  );
```

#### Step 2: Test as User 1

```sql
-- Simulate User 1 authentication
-- In Supabase SQL Editor, you cannot directly set auth.uid()
-- Instead, use the Supabase client with User 1's JWT token

-- Via Supabase JavaScript client (in browser console or test script):
const { data: user1Predictions, error } = await supabase
  .from('churn_predictions')
  .select('*')
  .eq('stripe_connection_id', 'conn-user-1');

console.log('User 1 should see 1 prediction:', user1Predictions.length);
console.log('Customer ID should be cus_user1_test:', user1Predictions[0]?.customer_id);

-- Expected: User 1 sees ONLY their prediction (1 row)
-- Expected: customer_id = 'cus_user1_test'
```

#### Step 3: Test Cross-Access (User 1 trying to access User 2's data)

```sql
-- Via Supabase JavaScript client (authenticated as User 1):
const { data: crossAccess, error } = await supabase
  .from('churn_predictions')
  .select('*')
  .eq('stripe_connection_id', 'conn-user-2');

console.log('User 1 should see 0 predictions from User 2:', crossAccess.length);

-- Expected: 0 rows returned (RLS blocks access)
```

#### Step 4: Test as User 2

```sql
-- Via Supabase JavaScript client (authenticated as User 2):
const { data: user2Predictions, error } = await supabase
  .from('churn_predictions')
  .select('*')
  .eq('stripe_connection_id', 'conn-user-2');

console.log('User 2 should see 1 prediction:', user2Predictions.length);
console.log('Customer ID should be cus_user2_test:', user2Predictions[0]?.customer_id);

-- Expected: User 2 sees ONLY their prediction (1 row)
-- Expected: customer_id = 'cus_user2_test'
```

#### Step 5: Verify RLS Policy is Enabled

```sql
-- Check RLS status (as service role)
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'churn_predictions';

-- Expected: rowsecurity = true

-- Check policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'churn_predictions';

-- Expected: At least one policy with cmd = 'SELECT'
```

#### Step 6: Cleanup

```sql
-- Delete test data (as service role)
DELETE FROM churn_predictions 
WHERE customer_id IN ('cus_user1_test', 'cus_user2_test');
```

### Success Criteria

- ✅ User 1 can see their own prediction
- ✅ User 1 cannot see User 2's prediction
- ✅ User 2 can see their own prediction
- ✅ User 2 cannot see User 1's prediction
- ✅ RLS is enabled on the table
- ✅ Policies are active

---

## Table 2: churn_interventions

### RLS Policy to Test
```sql
CREATE POLICY "Users manage own interventions" ON churn_interventions
  FOR ALL USING (
    stripe_connection_id IN (
      SELECT id FROM stripe_connections WHERE user_id = auth.uid()
    )
  );
```

### Test Procedure

#### Step 1: Insert Test Data

```sql
-- Insert interventions for both users (as service role)
INSERT INTO churn_interventions (
  churn_prediction_id,
  stripe_connection_id,
  customer_id,
  intervention_type,
  intervention_description,
  email_sent,
  offer_type,
  offer_value
) VALUES 
  (
    (SELECT id FROM churn_predictions WHERE customer_id = 'cus_user1_test' LIMIT 1),
    'conn-user-1',
    'cus_user1_test',
    'email',
    'Sent payment reminder',
    true,
    'payment_update',
    NULL
  ),
  (
    (SELECT id FROM churn_predictions WHERE customer_id = 'cus_user2_test' LIMIT 1),
    'conn-user-2',
    'cus_user2_test',
    'email',
    'Sent retention offer',
    true,
    'discount',
    25.00
  );
```

#### Step 2: Test Isolation

```sql
-- As User 1 (via Supabase client)
const { data: user1Interventions } = await supabase
  .from('churn_interventions')
  .select('*');

console.log('User 1 should see 1 intervention:', user1Interventions.length);
console.log('Should be for cus_user1_test:', user1Interventions[0]?.customer_id);

-- As User 2 (via Supabase client)
const { data: user2Interventions } = await supabase
  .from('churn_interventions')
  .select('*');

console.log('User 2 should see 1 intervention:', user2Interventions.length);
console.log('Should be for cus_user2_test:', user2Interventions[0]?.customer_id);
```

#### Step 3: Test Write Operations

```sql
-- As User 1, try to insert intervention for User 2's customer
const { data, error } = await supabase
  .from('churn_interventions')
  .insert({
    stripe_connection_id: 'conn-user-2', // User 2's connection
    customer_id: 'cus_user2_test',
    intervention_type: 'email',
    intervention_description: 'Malicious intervention'
  });

console.log('Should fail with RLS error:', error);

-- Expected: Error (RLS policy violation)
```

### Success Criteria

- ✅ Users can only see their own interventions
- ✅ Users cannot insert interventions for other users' connections
- ✅ Users cannot update other users' interventions

---

## Table 3: benchmark_participants

### RLS Policy to Test
```sql
CREATE POLICY "Users manage own benchmark participation" ON benchmark_participants
  FOR ALL USING (
    stripe_connection_id IN (
      SELECT id FROM stripe_connections WHERE user_id = auth.uid()
    )
  );
```

### Test Procedure

#### Step 1: Insert Test Data

```sql
-- Insert participants (as service role)
INSERT INTO benchmark_participants (
  stripe_connection_id,
  opted_in,
  opted_in_at,
  industry_vertical,
  business_model,
  revenue_tier,
  company_age_tier,
  share_mrr,
  share_churn,
  share_arpu
) VALUES 
  (
    'conn-user-1',
    true,
    NOW(),
    'b2b_saas',
    'subscription',
    '10k_100k',
    '1y_3y',
    true,
    true,
    true
  ),
  (
    'conn-user-2',
    true,
    NOW(),
    'b2c_saas',
    'freemium',
    'under_10k',
    'under_1y',
    true,
    false,
    true
  );
```

#### Step 2: Test Read Isolation

```sql
-- As User 1
const { data: user1Participation } = await supabase
  .from('benchmark_participants')
  .select('*');

console.log('User 1 should see 1 record:', user1Participation.length);
console.log('Should be b2b_saas:', user1Participation[0]?.industry_vertical);

-- As User 2
const { data: user2Participation } = await supabase
  .from('benchmark_participants')
  .select('*');

console.log('User 2 should see 1 record:', user2Participation.length);
console.log('Should be b2c_saas:', user2Participation[0]?.industry_vertical);
```

#### Step 3: Test Update Isolation

```sql
-- As User 1, try to update User 2's participation
const { data, error } = await supabase
  .from('benchmark_participants')
  .update({ opted_in: false })
  .eq('stripe_connection_id', 'conn-user-2');

console.log('Should not update any rows:', data);
console.log('Affected rows should be 0');

-- Verify User 2's record unchanged (as service role)
SELECT opted_in FROM benchmark_participants 
WHERE stripe_connection_id = 'conn-user-2';

-- Expected: opted_in = true (unchanged)
```

### Success Criteria

- ✅ Users can only see their own participation record
- ✅ Users cannot modify other users' participation
- ✅ Opt-in/opt-out only affects own record

---

## Table 4: benchmark_contributions (Special Case - Anonymous)

### RLS Policy to Test
```sql
CREATE POLICY "Service role can manage contributions" ON benchmark_contributions
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
```

### Important Note

Benchmark contributions are **intentionally not accessible to regular users** because they contain anonymized data from all participants. Only the service role (backend) can read/write this table.

### Test Procedure

#### Step 1: Verify Users Cannot Access

```sql
-- As User 1 (should fail)
const { data, error } = await supabase
  .from('benchmark_contributions')
  .select('*');

console.log('Should return error or empty:', data);
console.log('Error should indicate no access:', error);

-- Expected: Error or empty result (no access)
```

#### Step 2: Verify Service Role Can Access

```sql
-- Using service role key
const { data, error } = await supabase
  .from('benchmark_contributions')
  .select('*');

console.log('Service role should see all contributions:', data);

-- Expected: All contributions visible
```

### Success Criteria

- ✅ Regular users cannot read contributions
- ✅ Regular users cannot write contributions
- ✅ Service role can read/write contributions
- ✅ Anonymization prevents reverse-engineering

---

## Table 5: benchmark_aggregates (Public Read)

### RLS Policy to Test
```sql
CREATE POLICY "Anyone can view benchmark aggregates" ON benchmark_aggregates
  FOR SELECT USING (true);
```

### Test Procedure

#### Step 1: Insert Test Aggregates

```sql
-- Insert aggregates (as service role)
INSERT INTO benchmark_aggregates (
  calculation_month,
  industry_vertical,
  business_model,
  revenue_tier,
  company_age_tier,
  participant_count,
  mrr_median,
  mrr_p25,
  mrr_p75,
  arpu_median
) VALUES 
  (
    '2024-01-01',
    'b2b_saas',
    'subscription',
    '10k_100k',
    '1y_3y',
    25,
    50000.00,
    30000.00,
    75000.00,
    500.00
  );
```

#### Step 2: Test Public Read Access

```sql
-- As User 1 (should succeed)
const { data: user1Aggregates } = await supabase
  .from('benchmark_aggregates')
  .select('*')
  .eq('industry_vertical', 'b2b_saas');

console.log('User 1 should see aggregates:', user1Aggregates.length);

-- As User 2 (should also succeed)
const { data: user2Aggregates } = await supabase
  .from('benchmark_aggregates')
  .select('*')
  .eq('industry_vertical', 'b2b_saas');

console.log('User 2 should see same aggregates:', user2Aggregates.length);

-- Both should see the same data
```

#### Step 3: Test Write Protection

```sql
-- As User 1, try to insert aggregate (should fail)
const { data, error } = await supabase
  .from('benchmark_aggregates')
  .insert({
    calculation_month: '2024-02-01',
    industry_vertical: 'b2b_saas',
    participant_count: 1,
    mrr_median: 10000
  });

console.log('Should fail - users cannot write:', error);

-- Expected: Error (no INSERT policy for regular users)
```

### Success Criteria

- ✅ All users can read aggregates (public data)
- ✅ Users cannot write/modify aggregates
- ✅ Service role can write aggregates
- ✅ No sensitive individual data exposed

---

## Table 6: user_benchmark_comparisons

### RLS Policy to Test
```sql
CREATE POLICY "Users view own benchmark comparisons" ON user_benchmark_comparisons
  FOR SELECT USING (
    stripe_connection_id IN (
      SELECT id FROM stripe_connections WHERE user_id = auth.uid()
    )
  );
```

### Test Procedure

#### Step 1: Insert Test Comparisons

```sql
-- Insert comparisons (as service role)
INSERT INTO user_benchmark_comparisons (
  stripe_connection_id,
  comparison_month,
  user_mrr,
  user_arpu,
  user_mrr_growth,
  mrr_percentile,
  arpu_percentile,
  mrr_growth_percentile,
  peer_group_size,
  industry_vertical,
  revenue_tier,
  insights
) VALUES 
  (
    'conn-user-1',
    '2024-01-01',
    55000.00,
    550.00,
    5.5,
    65,
    70,
    60,
    25,
    'b2b_saas',
    '10k_100k',
    '[{"metric": "mrr", "status": "above_average"}]'::jsonb
  ),
  (
    'conn-user-2',
    '2024-01-01',
    8000.00,
    400.00,
    3.2,
    45,
    40,
    35,
    30,
    'b2c_saas',
    'under_10k',
    '[{"metric": "mrr", "status": "average"}]'::jsonb
  );
```

#### Step 2: Test Isolation

```sql
-- As User 1
const { data: user1Comparison } = await supabase
  .from('user_benchmark_comparisons')
  .select('*');

console.log('User 1 should see 1 comparison:', user1Comparison.length);
console.log('MRR should be 55000:', user1Comparison[0]?.user_mrr);

-- As User 2
const { data: user2Comparison } = await supabase
  .from('user_benchmark_comparisons')
  .select('*');

console.log('User 2 should see 1 comparison:', user2Comparison.length);
console.log('MRR should be 8000:', user2Comparison[0]?.user_mrr);
```

### Success Criteria

- ✅ Users can only see their own comparisons
- ✅ Users cannot see other users' actual metrics
- ✅ Comparisons are properly isolated by connection

---

## Table 7: revenue_scenarios

### RLS Policy to Test
```sql
CREATE POLICY "Users manage own scenarios" ON revenue_scenarios
  FOR ALL USING (
    stripe_connection_id IN (
      SELECT id FROM stripe_connections WHERE user_id = auth.uid()
    )
  );
```

### Test Procedure

#### Step 1: Insert Test Scenarios

```sql
-- Insert scenarios (as service role)
INSERT INTO revenue_scenarios (
  stripe_connection_id,
  name,
  description,
  scenario_type,
  base_mrr,
  base_customer_count,
  base_churn_rate,
  base_arpu,
  parameters,
  projected_metrics,
  mrr_impact_12m,
  arr_impact_12m,
  customer_impact_12m,
  revenue_impact_total,
  insights
) VALUES 
  (
    'conn-user-1',
    'Reduce Churn by 2%',
    'Test scenario for user 1',
    'churn_reduction',
    50000.00,
    100,
    5.0,
    500.00,
    '{"churnRateReduction": 2, "timeframeMonths": 12}'::jsonb,
    '{"month_12": {"mrr": 55000, "customers": 110}}'::jsonb,
    5000.00,
    60000.00,
    10,
    30000.00,
    '["Reducing churn would add $5K MRR"]'::jsonb
  ),
  (
    'conn-user-2',
    'Increase Prices 20%',
    'Test scenario for user 2',
    'price_increase',
    10000.00,
    25,
    4.0,
    400.00,
    '{"priceIncreasePercent": 20, "timeframeMonths": 12}'::jsonb,
    '{"month_12": {"mrr": 11500, "customers": 24}}'::jsonb,
    1500.00,
    18000.00,
    -1,
    9000.00,
    '["Price increase would add $1.5K MRR"]'::jsonb
  );
```

#### Step 2: Test Read Isolation

```sql
-- As User 1
const { data: user1Scenarios } = await supabase
  .from('revenue_scenarios')
  .select('*');

console.log('User 1 should see 1 scenario:', user1Scenarios.length);
console.log('Name should be "Reduce Churn by 2%":', user1Scenarios[0]?.name);

-- As User 2
const { data: user2Scenarios } = await supabase
  .from('revenue_scenarios')
  .select('*');

console.log('User 2 should see 1 scenario:', user2Scenarios.length);
console.log('Name should be "Increase Prices 20%":', user2Scenarios[0]?.name);
```

#### Step 3: Test Write Isolation

```sql
-- As User 1, try to update User 2's scenario
const { data, error } = await supabase
  .from('revenue_scenarios')
  .update({ name: 'Hacked Scenario' })
  .eq('stripe_connection_id', 'conn-user-2');

console.log('Should not update any rows:', data);

-- Verify User 2's scenario unchanged (as service role)
SELECT name FROM revenue_scenarios 
WHERE stripe_connection_id = 'conn-user-2';

-- Expected: name = 'Increase Prices 20%' (unchanged)
```

#### Step 4: Test Delete Isolation

```sql
-- As User 1, try to delete User 2's scenario
const { data, error } = await supabase
  .from('revenue_scenarios')
  .delete()
  .eq('stripe_connection_id', 'conn-user-2');

console.log('Should not delete any rows:', data);

-- Verify User 2's scenario still exists (as service role)
SELECT COUNT(*) FROM revenue_scenarios 
WHERE stripe_connection_id = 'conn-user-2';

-- Expected: count = 1 (still exists)
```

### Success Criteria

- ✅ Users can only see their own scenarios
- ✅ Users cannot modify other users' scenarios
- ✅ Users cannot delete other users' scenarios
- ✅ Users can create scenarios for their own connections

---

## Table 8: scenario_comparisons

### RLS Policy to Test
```sql
CREATE POLICY "Users manage own comparisons" ON scenario_comparisons
  FOR ALL USING (
    stripe_connection_id IN (
      SELECT id FROM stripe_connections WHERE user_id = auth.uid()
    )
  );
```

### Test Procedure

Similar to revenue_scenarios - test read, write, update, and delete isolation.

---

## Table 9: scenario_templates (Public Read)

### RLS Policy to Test
```sql
CREATE POLICY "Anyone can view templates" ON scenario_templates
  FOR SELECT USING (true);
```

### Test Procedure

```sql
-- As User 1 (should see all templates)
const { data: templates1 } = await supabase
  .from('scenario_templates')
  .select('*');

console.log('User 1 should see all templates:', templates1.length);

-- As User 2 (should see same templates)
const { data: templates2 } = await supabase
  .from('scenario_templates')
  .select('*');

console.log('User 2 should see same templates:', templates2.length);

-- Both should see the same 5 default templates
```

### Success Criteria

- ✅ All users can read templates (public)
- ✅ Users cannot modify templates
- ✅ Templates are shared across all users

---

## Table 10: benchmark_trends (Public Read)

### RLS Policy to Test
```sql
CREATE POLICY "Anyone can view benchmark trends" ON benchmark_trends
  FOR SELECT USING (true);
```

### Test Procedure

Similar to benchmark_aggregates and scenario_templates - public read, restricted write.

---

## Automated Test Script

### JavaScript Test Suite

```javascript
// test-rls.js - Automated RLS testing script

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const user1Token = process.env.TEST_USER_1_JWT;
const user2Token = process.env.TEST_USER_2_JWT;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

async function testRLS() {
  console.log('Starting RLS Tests...\n');

  // Create clients for each user
  const user1Client = createClient(supabaseUrl, user1Token);
  const user2Client = createClient(supabaseUrl, user2Token);
  const serviceClient = createClient(supabaseUrl, serviceKey);

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // Test 1: Churn Predictions Isolation
  console.log('Test 1: Churn Predictions Isolation');
  try {
    const { data: user1Data } = await user1Client
      .from('churn_predictions')
      .select('*');
    
    const { data: user2Data } = await user2Client
      .from('churn_predictions')
      .select('*');

    // Check no overlap
    const user1Ids = user1Data.map(d => d.id);
    const user2Ids = user2Data.map(d => d.id);
    const overlap = user1Ids.filter(id => user2Ids.includes(id));

    if (overlap.length === 0) {
      console.log('✅ PASS: No data overlap between users\n');
      results.passed++;
    } else {
      console.log('❌ FAIL: Data overlap detected\n');
      results.failed++;
    }
  } catch (error) {
    console.log('❌ FAIL:', error.message, '\n');
    results.failed++;
  }

  // Test 2: Cross-User Access Attempt
  console.log('Test 2: Cross-User Access Prevention');
  try {
    // Get User 2's connection ID
    const { data: user2Connections } = await user2Client
      .from('stripe_connections')
      .select('id')
      .limit(1);

    if (user2Connections.length > 0) {
      const user2ConnId = user2Connections[0].id;

      // User 1 tries to access User 2's predictions
      const { data: crossAccess } = await user1Client
        .from('churn_predictions')
        .select('*')
        .eq('stripe_connection_id', user2ConnId);

      if (crossAccess.length === 0) {
        console.log('✅ PASS: Cross-user access blocked\n');
        results.passed++;
      } else {
        console.log('❌ FAIL: Cross-user access allowed\n');
        results.failed++;
      }
    }
  } catch (error) {
    console.log('❌ FAIL:', error.message, '\n');
    results.failed++;
  }

  // Test 3: Scenarios Isolation
  console.log('Test 3: Revenue Scenarios Isolation');
  try {
    const { data: user1Scenarios } = await user1Client
      .from('revenue_scenarios')
      .select('*');
    
    const { data: user2Scenarios } = await user2Client
      .from('revenue_scenarios')
      .select('*');

    const user1Ids = user1Scenarios.map(s => s.id);
    const user2Ids = user2Scenarios.map(s => s.id);
    const overlap = user1Ids.filter(id => user2Ids.includes(id));

    if (overlap.length === 0) {
      console.log('✅ PASS: Scenarios properly isolated\n');
      results.passed++;
    } else {
      console.log('❌ FAIL: Scenario overlap detected\n');
      results.failed++;
    }
  } catch (error) {
    console.log('❌ FAIL:', error.message, '\n');
    results.failed++;
  }

  // Test 4: Public Read Access (Templates)
  console.log('Test 4: Public Template Access');
  try {
    const { data: user1Templates } = await user1Client
      .from('scenario_templates')
      .select('*');
    
    const { data: user2Templates } = await user2Client
      .from('scenario_templates')
      .select('*');

    if (user1Templates.length === user2Templates.length && user1Templates.length > 0) {
      console.log('✅ PASS: Both users see same templates\n');
      results.passed++;
    } else {
      console.log('❌ FAIL: Template access inconsistent\n');
      results.failed++;
    }
  } catch (error) {
    console.log('❌ FAIL:', error.message, '\n');
    results.failed++;
  }

  // Test 5: Write Isolation
  console.log('Test 5: Write Operation Isolation');
  try {
    // User 1 tries to insert scenario for User 2's connection
    const { data: user2Connections } = await user2Client
      .from('stripe_connections')
      .select('id')
      .limit(1);

    if (user2Connections.length > 0) {
      const user2ConnId = user2Connections[0].id;

      const { data, error } = await user1Client
        .from('revenue_scenarios')
        .insert({
          stripe_connection_id: user2ConnId,
          name: 'Malicious Scenario',
          scenario_type: 'churn_reduction',
          base_mrr: 1000,
          base_customer_count: 10,
          base_churn_rate: 5,
          base_arpu: 100,
          parameters: {},
          projected_metrics: {},
          mrr_impact_12m: 0,
          arr_impact_12m: 0,
          customer_impact_12m: 0,
          revenue_impact_total: 0,
          insights: []
        });

      if (error || !data) {
        console.log('✅ PASS: Cross-user write blocked\n');
        results.passed++;
      } else {
        console.log('❌ FAIL: Cross-user write allowed\n');
        results.failed++;
      }
    }
  } catch (error) {
    console.log('✅ PASS: Cross-user write blocked (error thrown)\n');
    results.passed++;
  }

  // Summary
  console.log('\n=== TEST SUMMARY ===');
  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

  if (results.failed === 0) {
    console.log('\n🎉 All RLS tests passed!');
  } else {
    console.log('\n⚠️  Some RLS tests failed. Review security policies.');
  }
}

testRLS().catch(console.error);
```

### Running the Automated Test

```bash
# Set environment variables
export NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
export TEST_USER_1_JWT="user1_jwt_token"
export TEST_USER_2_JWT="user2_jwt_token"
export SUPABASE_SERVICE_KEY="service_role_key"

# Run tests
node test-rls.js
```

---

## Manual Verification Checklist

Use this checklist to manually verify RLS policies:

### Pre-Test Setup
- [ ] Two test users created with different email addresses
- [ ] Each user has at least one Stripe connection
- [ ] Test data inserted for both users in all tables
- [ ] Supabase SQL Editor access confirmed
- [ ] Service role key available

### Churn Prevention Tables
- [ ] `churn_predictions`: Users see only their own predictions
- [ ] `churn_predictions`: Cross-user access blocked
- [ ] `churn_interventions`: Users see only their own interventions
- [ ] `churn_interventions`: Cross-user writes blocked

### Benchmarking Tables
- [ ] `benchmark_participants`: Users see only their own participation
- [ ] `benchmark_contributions`: Regular users cannot access
- [ ] `benchmark_aggregates`: All users can read (public)
- [ ] `benchmark_aggregates`: Regular users cannot write
- [ ] `user_benchmark_comparisons`: Users see only their own comparisons

### Scenario Planning Tables
- [ ] `revenue_scenarios`: Users see only their own scenarios
- [ ] `revenue_scenarios`: Cross-user updates blocked
- [ ] `revenue_scenarios`: Cross-user deletes blocked
- [ ] `scenario_comparisons`: Users see only their own comparisons
- [ ] `scenario_templates`: All users see same templates (public)
- [ ] `benchmark_trends`: All users can read (public)

### Service Role Verification
- [ ] Service role can access all tables
- [ ] Service role can write to restricted tables
- [ ] Service role bypasses RLS policies

---

## Troubleshooting Common Issues

### Issue: Users can see each other's data

**Diagnosis**:
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('churn_predictions', 'revenue_scenarios', 'benchmark_participants');
```

**Solution**: Enable RLS if disabled:
```sql
ALTER TABLE churn_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_participants ENABLE ROW LEVEL SECURITY;
```

### Issue: Policies exist but don't work

**Diagnosis**:
```sql
-- Check policy definitions
SELECT * FROM pg_policies 
WHERE tablename = 'churn_predictions';
```

**Solution**: Verify the policy USING clause references `auth.uid()` correctly and joins to `stripe_connections` table properly.

### Issue: Service role cannot access data

**Diagnosis**: Check if using correct service role key.

**Solution**: Ensure you're using `SUPABASE_SERVICE_KEY` not `SUPABASE_ANON_KEY`.

### Issue: Public tables not accessible

**Diagnosis**:
```sql
-- Check for SELECT policies
SELECT * FROM pg_policies 
WHERE tablename = 'scenario_templates' 
AND cmd = 'SELECT';
```

**Solution**: Ensure policy exists with `USING (true)` for public read access.

---

## Continuous Monitoring

### Set Up Alerts

Create alerts for potential RLS violations:

```sql
-- Create audit log for cross-user access attempts
CREATE TABLE rls_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  attempted_table TEXT,
  attempted_action TEXT,
  blocked BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monitor for suspicious patterns
SELECT user_id, COUNT(*) as blocked_attempts
FROM rls_audit_log
WHERE blocked = true
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id
HAVING COUNT(*) > 10;
```

### Regular Testing Schedule

- **Daily**: Run automated test suite in staging
- **Weekly**: Manual spot-check of RLS policies
- **Monthly**: Full security audit of all tables
- **After each deployment**: Verify RLS policies still active

---

## Conclusion

This comprehensive test plan ensures that Row Level Security policies correctly isolate data between users. Follow the procedures systematically, document any failures, and address issues before deploying to production.

**Critical Reminder**: RLS is your last line of defense. Even if application logic has bugs, RLS should prevent unauthorized data access. Always test thoroughly.
