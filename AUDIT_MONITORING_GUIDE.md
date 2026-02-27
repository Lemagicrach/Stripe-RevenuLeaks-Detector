# RLS Audit Monitoring Guide

This guide explains how to use the audit logging system to monitor and detect potential Row Level Security violations in your RevPilot deployment.

## Quick Start

### Installation

Run the audit logging SQL script to set up the monitoring system:

```bash
psql $DATABASE_URL -f rls-audit-logging.sql
```

This creates the audit log table, triggers, monitoring views, and alert functions.

### Verify Installation

```sql
SELECT * FROM v_audit_log_stats;
```

You should see a summary of the audit log table with zero records initially.

## What Gets Logged

The audit system automatically logs all access attempts to protected tables, capturing user information including user ID, email, and role, request details such as the table accessed, action attempted (SELECT, INSERT, UPDATE, DELETE), and the connection ID they tried to access. It also records the result, including whether the attempt was blocked, any error messages, and the number of rows affected. Additional context like IP address, user agent, and request ID is captured when available.

## Daily Monitoring Routine

### Step 1: Check for Suspicious Users

Run this query every morning to identify users with multiple blocked access attempts in the last 24 hours:

```sql
SELECT * FROM v_suspicious_users;
```

**What to look for**: Any users with more than 5 blocked attempts. This could indicate either a bug in your application code or a malicious user trying to access data they shouldn't.

**Example output**:
```
user_id | user_email        | blocked_attempts | tables_attempted | first_attempt | last_attempt
--------|-------------------|------------------|------------------|---------------|-------------
uuid-1  | user@example.com  | 15               | 3                | 2024-01-10... | 2024-01-10...
```

**Action**: If you see suspicious activity, investigate the user's recent actions and consider temporarily disabling their account while you investigate.

### Step 2: Review Recent Blocked Attempts

Check the most recent blocked access attempts:

```sql
SELECT * FROM v_recent_blocked_attempts LIMIT 20;
```

**What to look for**: Patterns in the blocked attempts. Are they all from the same user? Are they targeting specific tables? Are they happening at unusual times?

**Action**: If you see a pattern, investigate the root cause. It could be a bug in your frontend code that's making incorrect API calls.

### Step 3: Check Current Threats

Get a real-time view of active threats:

```sql
SELECT * FROM get_current_threats();
```

**What to look for**: Any users with a threat level of "HIGH" or "CRITICAL". These users have made many blocked attempts in the last hour.

**Example output**:
```
threat_level | user_email       | recent_blocked_count | last_attempt | attempted_tables
-------------|------------------|----------------------|--------------|------------------
CRITICAL     | bad@actor.com    | 25                   | 2024-01-10...| {churn_predictions, revenue_scenarios}
```

**Action**: Immediately investigate CRITICAL threats. Consider rate-limiting or blocking the user.

### Step 4: Generate Daily Report

Create a summary report for the previous day:

```sql
SELECT * FROM generate_daily_security_report();
```

**What to look for**: Trends over time. Is the number of blocked attempts increasing? Are more users triggering security alerts?

**Action**: Track these metrics in a spreadsheet or monitoring dashboard to identify long-term trends.

### Step 5: Check for Anomalies

Run the anomaly detection function to identify unusual patterns:

```sql
SELECT * FROM detect_anomalous_access() 
WHERE severity IN ('high', 'critical')
ORDER BY severity, detected_at DESC;
```

**What to look for**: The function detects four types of anomalies. Multiple blocked attempts occur when a user has 10+ blocked attempts in the last hour. Multiple connection access happens when a user tries to access 5+ different connections in an hour. Unusual time access is detected when attempts occur outside business hours (before 6 AM or after 10 PM). Rapid successive attempts are flagged when there are 20+ attempts in 5 minutes.

**Action**: Investigate high-severity anomalies immediately. Medium and low severity can be reviewed during weekly monitoring.

## Weekly Monitoring Routine

### Review Access Patterns

Analyze which tables are being accessed and how often attempts are blocked:

```sql
SELECT * FROM v_access_patterns_by_table;
```

**What to look for**: Tables with high block rates. A block rate above 10% might indicate a problem with your application logic or RLS policies.

**Example output**:
```
attempted_table      | attempted_action | total_attempts | blocked_attempts | successful_attempts | block_rate_percent
---------------------|------------------|----------------|------------------|---------------------|-------------------
churn_predictions    | SELECT           | 1000           | 50               | 950                 | 5.00
revenue_scenarios    | UPDATE           | 200            | 25               | 175                 | 12.50
```

**Action**: If a table has a high block rate, review the RLS policies and application code to ensure they're aligned.

### Check Audit Log Size

Monitor the growth of the audit log table:

```sql
SELECT * FROM v_audit_log_stats;
```

**What to look for**: Rapid growth in the audit log. If the table is growing too quickly, you may need to adjust your archiving schedule.

**Action**: If the table size exceeds 1GB, run the archive function to move old records to the archive table.

### Archive Old Logs

Keep the audit log table manageable by archiving records older than 90 days:

```sql
SELECT archive_old_audit_logs(90);
```

This moves old records to the `rls_audit_log_archive` table, which you can query for historical analysis.

**Action**: Run this weekly to keep the main audit table performant.

## Monthly Monitoring Routine

### Review User Activity Summary

Get a comprehensive view of all user activity over the last 30 days:

```sql
SELECT * FROM v_user_activity_summary
ORDER BY blocked_attempts DESC
LIMIT 20;
```

**What to look for**: Users with consistently high blocked attempt rates. This could indicate they're using your application incorrectly or have a misunderstanding of permissions.

**Action**: Reach out to users with high blocked attempt rates to understand if they're experiencing issues with the application.

### Analyze Trends

Look at daily trends over the past month:

```sql
SELECT 
  date_trunc('day', created_at)::date as day,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE blocked = true) as blocked_attempts,
  ROUND(100.0 * COUNT(*) FILTER (WHERE blocked = true) / COUNT(), 2) as block_rate
FROM rls_audit_log
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY date_trunc('day', created_at)
ORDER BY day DESC;
```

**What to look for**: Spikes in blocked attempts on specific days. This could correlate with deployments, feature releases, or security incidents.

**Action**: Cross-reference spikes with your deployment log to identify if code changes introduced bugs.

## Real-time Alerts

For production environments, set up automated alerts that run every 5 minutes to catch security issues immediately.

### Setup with Supabase Edge Functions

Create an Edge Function that runs on a schedule:

```typescript
// supabase/functions/security-alerts/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Get current alerts
  const { data: alerts, error } = await supabase
    .rpc('get_alerts_for_notification')

  if (error) {
    console.error('Error fetching alerts:', error)
    return new Response(JSON.stringify({ error }), { status: 500 })
  }

  // Send alerts to Slack, email, etc.
  for (const alert of alerts) {
    if (alert.severity === 'high' || alert.severity === 'critical') {
      await sendSlackAlert(alert)
    }
  }

  return new Response(
    JSON.stringify({ processed: alerts.length }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})

async function sendSlackAlert(alert: any) {
  const webhookUrl = Deno.env.get('SLACK_WEBHOOK_URL')
  
  await fetch(webhookUrl!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `🚨 Security Alert: ${alert.severity}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${alert.severity.toUpperCase()} Security Alert*\n${alert.message}\n\nUser: ${alert.user_email}\nTime: ${alert.created_at}`
          }
        }
      ]
    })
  })
}
```

Schedule this function to run every 5 minutes using Supabase cron:

```sql
-- In Supabase SQL Editor
SELECT cron.schedule(
  'security-alerts',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/security-alerts',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);
```

### Setup with External Monitoring

If you prefer external monitoring tools, create an API endpoint that exposes the alerts:

```typescript
// app/api/security/alerts/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // Verify request is from monitoring system
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.MONITORING_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const { data, error } = await supabase
    .rpc('get_alerts_for_notification')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ alerts: data })
}
```

Then configure your monitoring tool (Datadog, New Relic, etc.) to poll this endpoint every 5 minutes.

## Understanding Alert Severity Levels

The audit system categorizes alerts into four severity levels, each requiring different response times and actions.

**CRITICAL** alerts indicate 20+ blocked attempts in 5 minutes or attempts to access 10+ different connections in an hour. The response time should be immediate (within 5 minutes), and actions include blocking the user account, investigating for security breach, and reviewing application logs.

**HIGH** alerts show 10+ blocked attempts in 1 hour or multiple connection access attempts. Response time should be within 1 hour, with actions to investigate user activity, check for application bugs, and consider rate limiting.

**MEDIUM** alerts indicate 5-9 blocked attempts in 1 hour or access to 3-5 different connections. Response time should be within 24 hours, with actions to review user's recent activity and monitor for escalation.

**LOW** alerts show unusual time access or 2-4 blocked attempts in 1 hour. Response time can be within 1 week, with actions to note the pattern and include in weekly review.

## Common Patterns and What They Mean

### Pattern 1: Single User, Multiple Tables

**What it looks like**: One user has blocked attempts across many different tables (churn_predictions, revenue_scenarios, benchmark_participants).

**What it means**: The user is likely trying to access data they shouldn't, either maliciously or due to a bug in the frontend that's making incorrect API calls.

**Action**: Review the user's account and recent activity. Check if there's a bug in the UI that's causing this.

### Pattern 2: Multiple Users, Same Table

**What it looks like**: Many different users have blocked attempts on the same table.

**What it means**: There's likely a bug in your application code or RLS policies for that specific table.

**Action**: Review the RLS policies for that table and check recent code changes that might have introduced the bug.

### Pattern 3: Spike at Specific Time

**What it looks like**: A sudden spike in blocked attempts at a specific time (e.g., 2 PM on Tuesday).

**What it means**: Correlates with a deployment, feature release, or external event.

**Action**: Check your deployment log. If a deployment happened at that time, roll back and investigate.

### Pattern 4: Gradual Increase Over Time

**What it looks like**: Blocked attempts are slowly increasing week over week.

**What it means**: Your user base is growing, or users are increasingly running into permission issues.

**Action**: Analyze if the increase is proportional to user growth. If not, investigate why users are hitting more permission errors.

## Troubleshooting

### Issue: Audit log not capturing events

**Check**: Verify triggers are enabled:

```sql
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname LIKE 'audit_%';
```

All triggers should show `tgenabled = 'O'` (enabled).

**Fix**: If disabled, re-run the audit logging SQL script.

### Issue: Too many false positives

**Check**: Review the alert thresholds in the `detect_anomalous_access()` function.

**Fix**: Adjust the thresholds to match your application's normal usage patterns. For example, if legitimate users often access 5+ connections, increase the threshold.

### Issue: Audit log growing too fast

**Check**: Run `SELECT * FROM v_audit_log_stats;` to see growth rate.

**Fix**: Reduce retention period by running `SELECT archive_old_audit_logs(30);` to keep only 30 days instead of 90.

### Issue: Performance degradation

**Check**: Verify indexes exist:

```sql
SELECT indexname FROM pg_indexes 
WHERE tablename = 'rls_audit_log';
```

**Fix**: If indexes are missing, re-run the audit logging SQL script.

## Best Practices

**Establish a baseline** by monitoring for 2-4 weeks after deployment to understand normal patterns before setting up automated alerts. **Set appropriate thresholds** by adjusting alert thresholds based on your baseline to reduce false positives. **Automate responses** by creating automated responses for common patterns, such as rate-limiting users with high blocked attempt rates. **Regular reviews** should be conducted weekly, not just when alerts fire, to catch slow-developing issues. **Document incidents** by keeping a log of security incidents and how you resolved them for future reference. **Test your alerts** by periodically triggering test alerts to ensure your monitoring system is working.

## Integration with Other Tools

### Slack Integration

Send critical alerts to Slack using webhooks (see Real-time Alerts section above).

### Email Notifications

Use SendGrid or similar to email security team when critical alerts occur:

```typescript
import sgMail from '@sendgrid/mail'

async function sendSecurityEmail(alert: any) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY!)
  
  await sgMail.send({
    to: 'security@yourcompany.com',
    from: 'alerts@yourcompany.com',
    subject: `${alert.severity.toUpperCase()} Security Alert`,
    text: alert.message,
    html: `
      <h2>${alert.severity.toUpperCase()} Security Alert</h2>
      <p>${alert.message}</p>
      <p><strong>User:</strong> ${alert.user_email}</p>
      <p><strong>Time:</strong> ${alert.created_at}</p>
    `
  })
}
```

### Dashboard Integration

Create a security dashboard in your admin panel:

```typescript
// app/admin/security/page.tsx
import { createClient } from '@supabase/supabase-js'

export default async function SecurityDashboard() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const [threats, suspicious, patterns] = await Promise.all([
    supabase.rpc('get_current_threats'),
    supabase.from('v_suspicious_users').select('*'),
    supabase.from('v_access_patterns_by_table').select('*')
  ])

  return (
    <div>
      <h1>Security Dashboard</h1>
      
      <section>
        <h2>Current Threats</h2>
        <table>
          {/* Display threats.data */}
        </table>
      </section>

      <section>
        <h2>Suspicious Users</h2>
        <table>
          {/* Display suspicious.data */}
        </table>
      </section>

      <section>
        <h2>Access Patterns</h2>
        <table>
          {/* Display patterns.data */}
        </table>
      </section>
    </div>
  )
}
```

## Conclusion

The audit logging system provides comprehensive visibility into access patterns and potential security violations in your RevPilot deployment. By following this monitoring guide and establishing a regular review routine, you can quickly identify and respond to security issues before they become serious problems.

Remember that the audit system is a safety net, not a replacement for proper RLS policies and application security. Always ensure your RLS policies are correctly configured and tested before relying on the audit system to catch violations.
