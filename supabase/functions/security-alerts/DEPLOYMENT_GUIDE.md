# Security Alerts Edge Function - Deployment Guide

This guide walks you through deploying the security alerts Edge Function to Supabase.

## Prerequisites

- Supabase CLI installed (`npm install -g supabase`)
- Supabase project created
- Slack workspace with incoming webhook configured
- (Optional) SendGrid account for email alerts

## Step 1: Set Up Slack Webhook

### Create Incoming Webhook

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name it "RevPilot Security Alerts"
4. Select your workspace
5. Click "Incoming Webhooks" in the sidebar
6. Toggle "Activate Incoming Webhooks" to ON
7. Click "Add New Webhook to Workspace"
8. Select the channel where you want alerts (e.g., #security-alerts)
9. Copy the webhook URL (looks like `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX`)

### Test Webhook

```bash
curl -X POST -H 'Content-Type: application/json' \
  -d '{"text":"Test alert from RevPilot"}' \
  YOUR_WEBHOOK_URL
```

You should see a message appear in your Slack channel.

## Step 2: Set Up SendGrid (Optional)

If you want email notifications for critical alerts:

1. Sign up at https://sendgrid.com
2. Create an API key with "Mail Send" permissions
3. Verify your sender email address
4. Copy the API key

## Step 3: Deploy Edge Function

### Login to Supabase

```bash
supabase login
```

### Link to Your Project

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

Find your project ref in the Supabase dashboard URL: `https://app.supabase.com/project/YOUR_PROJECT_REF`

### Deploy the Function

```bash
# Navigate to the edge function directory
cd /path/to/edge-function-security-alerts

# Deploy
supabase functions deploy security-alerts
```

## Step 4: Set Environment Variables

Set the required secrets for your Edge Function:

```bash
# Required: Supabase credentials
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Required: Slack webhook
supabase secrets set SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Optional: Email alerts
supabase secrets set ALERT_EMAIL=security@yourcompany.com
supabase secrets set SENDGRID_API_KEY=SG.your_sendgrid_key

# Optional: Cron secret for security
supabase secrets set CRON_SECRET=$(openssl rand -hex 32)
```

### Verify Secrets

```bash
supabase secrets list
```

## Step 5: Create Alert Processing Log Table

Run this SQL in your Supabase SQL Editor:

```sql
-- Table to track alert processing
CREATE TABLE IF NOT EXISTS alert_processing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processed_at TIMESTAMPTZ NOT NULL,
  alerts_count INTEGER NOT NULL,
  threats_count INTEGER NOT NULL,
  critical_count INTEGER NOT NULL,
  high_count INTEGER NOT NULL,
  notifications_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying recent processing
CREATE INDEX idx_alert_processing_log_processed_at 
  ON alert_processing_log(processed_at DESC);

-- RLS policy
ALTER TABLE alert_processing_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage alert processing log" 
  ON alert_processing_log
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
```

## Step 6: Set Up Cron Schedule

Schedule the function to run every 5 minutes:

```sql
-- In Supabase SQL Editor
SELECT cron.schedule(
  'security-alerts-every-5-minutes',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT.supabase.co/functions/v1/security-alerts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

### Alternative: Use Supabase Cron (Recommended)

If you have access to Supabase's built-in cron:

```sql
SELECT cron.schedule(
  'security-alerts',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/security-alerts',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);
```

## Step 7: Test the Function

### Manual Test

Invoke the function manually to test:

```bash
supabase functions invoke security-alerts \
  --method POST \
  --body '{}'
```

You should see output like:

```json
{
  "success": true,
  "alerts_processed": 0,
  "threats_detected": 0,
  "notifications_sent": 0,
  "timestamp": "2024-01-10T12:00:00.000Z"
}
```

### Test with Mock Data

Create some test blocked attempts to trigger alerts:

```sql
-- Insert test blocked attempt
INSERT INTO rls_audit_log (
  user_id,
  user_email,
  attempted_table,
  attempted_action,
  blocked,
  error_message
) VALUES (
  auth.uid(),
  'test@example.com',
  'churn_predictions',
  'SELECT',
  true,
  'Test blocked attempt'
);

-- Insert multiple to trigger alert
INSERT INTO rls_audit_log (user_id, user_email, attempted_table, attempted_action, blocked)
SELECT 
  auth.uid(),
  'test@example.com',
  'churn_predictions',
  'SELECT',
  true
FROM generate_series(1, 15); -- Creates 15 blocked attempts
```

Then invoke the function again:

```bash
supabase functions invoke security-alerts
```

You should receive a Slack notification!

## Step 8: Monitor Function Logs

View logs in real-time:

```bash
supabase functions logs security-alerts --tail
```

Or view in the Supabase dashboard:
1. Go to Edge Functions
2. Click on "security-alerts"
3. Click "Logs" tab

## Step 9: Verify Cron is Running

Check that the cron job is scheduled:

```sql
SELECT * FROM cron.job WHERE jobname = 'security-alerts-every-5-minutes';
```

Check recent cron runs:

```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'security-alerts-every-5-minutes')
ORDER BY start_time DESC
LIMIT 10;
```

## Troubleshooting

### Function Not Receiving Alerts

**Check**: Verify the RLS audit system is installed:

```sql
SELECT COUNT(*) FROM rls_audit_log;
```

**Fix**: Run the `rls-audit-logging.sql` script if the table doesn't exist.

### Slack Notifications Not Sending

**Check**: Verify webhook URL is correct:

```bash
supabase secrets list | grep SLACK_WEBHOOK_URL
```

**Fix**: Update the secret with the correct webhook URL.

### Cron Not Triggering

**Check**: Verify cron job exists:

```sql
SELECT * FROM cron.job;
```

**Fix**: Re-run the cron schedule SQL from Step 6.

### Function Errors

**Check**: View function logs:

```bash
supabase functions logs security-alerts --tail
```

**Fix**: Common issues:
- Missing environment variables → Set all required secrets
- Database connection errors → Verify SUPABASE_URL and service key
- Slack webhook errors → Test webhook URL manually

### Email Not Sending

**Check**: Verify SendGrid credentials:

```bash
supabase secrets list | grep SENDGRID
```

**Fix**: Ensure both `SENDGRID_API_KEY` and `ALERT_EMAIL` are set.

## Customization

### Adjust Alert Frequency

To run every 10 minutes instead of 5:

```sql
-- Update cron schedule
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'security-alerts-every-5-minutes'),
  schedule := '*/10 * * * *'
);
```

### Customize Slack Message

Edit the `buildSlackMessage()` function in `index.ts` to change:
- Message format
- Number of alerts shown
- Color coding
- Button URLs

Then redeploy:

```bash
supabase functions deploy security-alerts
```

### Add More Notification Channels

Add support for Discord, Microsoft Teams, PagerDuty, etc. by:

1. Adding webhook URL to secrets
2. Creating a new `sendXNotification()` function
3. Calling it in the main handler

Example for Discord:

```typescript
async function sendDiscordNotification(alerts: Alert[]): Promise<void> {
  const webhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL')
  if (!webhookUrl) return

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `🚨 ${alerts.length} security alerts detected`,
      embeds: alerts.map(alert => ({
        title: `${alert.severity.toUpperCase()} Alert`,
        description: alert.message,
        color: alert.severity === 'critical' ? 0xFF0000 : 0xFFA500,
        fields: [
          { name: 'User', value: alert.user_email, inline: true },
          { name: 'Time', value: new Date(alert.created_at).toLocaleString(), inline: true }
        ]
      }))
    })
  })
}
```

## Production Checklist

Before going live, ensure:

- [ ] All environment variables are set
- [ ] Slack webhook is tested and working
- [ ] Cron job is scheduled and running
- [ ] Function logs show successful executions
- [ ] Alert processing log table exists
- [ ] RLS audit system is installed
- [ ] Test alerts are received in Slack
- [ ] Email notifications work (if configured)
- [ ] Function error notifications work
- [ ] Monitoring is set up for function failures

## Maintenance

### Weekly

- Review function logs for errors
- Check alert processing log for trends
- Verify cron is running consistently

### Monthly

- Review and adjust alert thresholds if needed
- Update function dependencies
- Archive old alert processing logs

### As Needed

- Update Slack webhook if channel changes
- Rotate SendGrid API key
- Update function code for new features

## Support

If you encounter issues:

1. Check function logs: `supabase functions logs security-alerts`
2. Verify secrets: `supabase secrets list`
3. Test manually: `supabase functions invoke security-alerts`
4. Review cron runs: Check `cron.job_run_details` table

## Next Steps

After deployment:

1. Monitor Slack channel for first alerts
2. Adjust alert thresholds based on your traffic
3. Set up additional notification channels if needed
4. Create runbooks for responding to different alert types
5. Train your team on interpreting and responding to alerts

---

**Congratulations!** Your security alerts system is now live and monitoring for RLS violations 24/7.
