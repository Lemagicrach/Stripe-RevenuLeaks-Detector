# RevPilot Security Alerts - Supabase Edge Function

Real-time security monitoring and alerting system for RevPilot's Row Level Security (RLS) audit logs.

## Overview

This Supabase Edge Function automatically monitors your RLS audit logs every 5 minutes and sends real-time alerts to Slack (and optionally email) when suspicious activity is detected.

## Features

- **Automated Monitoring**: Runs every 5 minutes via Supabase cron
- **Multi-Channel Alerts**: Sends notifications to Slack and email
- **Rich Formatting**: Beautiful Slack messages with severity levels and context
- **Threat Detection**: Identifies active threats with severity ratings
- **Error Handling**: Automatically reports function errors to Slack
- **Audit Trail**: Logs all alert processing for compliance

## What Gets Monitored

The function monitors for:

1. **Critical Alerts**: 20+ blocked attempts in 5 minutes
2. **High Alerts**: 10+ blocked attempts in 1 hour
3. **Active Threats**: Users with multiple blocked attempts across tables
4. **Anomalous Patterns**: Unusual access times, rapid attempts, etc.

## Alert Severity Levels

- **CRITICAL**: Immediate action required (20+ attempts in 5 min)
- **HIGH**: Urgent attention needed (10+ attempts in 1 hour)
- **MEDIUM**: Review within 24 hours (5-9 attempts)
- **LOW**: Note for weekly review (2-4 attempts)

## Files Included

```
edge-function-security-alerts/
├── index.ts              # Main Edge Function code
├── supabase.yml          # Function configuration
├── import_map.json       # Deno import map
├── DEPLOYMENT_GUIDE.md   # Step-by-step deployment instructions
└── README.md            # This file
```

## Quick Start

### 1. Install Prerequisites

```bash
npm install -g supabase
```

### 2. Set Up Slack Webhook

1. Create a Slack app at https://api.slack.com/apps
2. Enable Incoming Webhooks
3. Add webhook to your desired channel
4. Copy the webhook URL

### 3. Deploy Function

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
cd edge-function-security-alerts
supabase functions deploy security-alerts
```

### 4. Set Environment Variables

```bash
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
supabase secrets set SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Optional: Email alerts
supabase secrets set ALERT_EMAIL=security@yourcompany.com
supabase secrets set SENDGRID_API_KEY=SG.your_key
```

### 5. Schedule Cron Job

Run this SQL in Supabase SQL Editor:

```sql
SELECT cron.schedule(
  'security-alerts',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/security-alerts',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);
```

### 6. Test

```bash
supabase functions invoke security-alerts
```

Check your Slack channel for alerts!

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL | `https://abc123.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key from project settings | `eyJhbGc...` |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook URL | `https://hooks.slack.com/...` |

### Optional

| Variable | Description | Example |
|----------|-------------|---------|
| `ALERT_EMAIL` | Email address for critical alerts | `security@company.com` |
| `SENDGRID_API_KEY` | SendGrid API key for email | `SG.abc123...` |
| `CRON_SECRET` | Secret for authenticating cron requests | `random-hex-string` |

## Slack Message Format

The function sends rich Slack messages with:

- **Header**: Urgency level and emoji (🚨 for critical, ⚠️ for warnings)
- **Summary**: Count of critical, high alerts, and active threats
- **Priority Alerts**: Up to 5 most severe alerts with details
- **Active Threats**: Up to 3 highest-risk users
- **Recommended Actions**: Checklist of response steps
- **Action Button**: Link to security dashboard

## Email Format

Critical alerts also trigger HTML emails with:

- Red header indicating urgency
- Summary table of alert counts
- Detailed list of each critical alert
- Active threat information
- Recommended action items

## Function Response

The function returns JSON with processing results:

```json
{
  "success": true,
  "alerts_processed": 5,
  "threats_detected": 2,
  "notifications_sent": 2,
  "timestamp": "2024-01-10T12:00:00.000Z"
}
```

## Monitoring

### View Logs

```bash
supabase functions logs security-alerts --tail
```

### Check Cron Status

```sql
SELECT * FROM cron.job WHERE jobname = 'security-alerts';
```

### View Processing History

```sql
SELECT * FROM alert_processing_log 
ORDER BY processed_at DESC 
LIMIT 10;
```

## Customization

### Change Alert Frequency

Edit the cron schedule (default is every 5 minutes):

```sql
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'security-alerts'),
  schedule := '*/10 * * * *' -- Every 10 minutes
);
```

### Customize Slack Message

Edit the `buildSlackMessage()` function in `index.ts` to:
- Change colors and emojis
- Adjust number of alerts shown
- Modify message format
- Add custom fields

### Add More Channels

Add support for Discord, Teams, PagerDuty, etc. by:
1. Adding webhook URL to secrets
2. Creating notification function
3. Calling it in main handler

## Troubleshooting

### No Alerts Received

**Check**: Is the RLS audit system installed?

```sql
SELECT COUNT(*) FROM rls_audit_log;
```

**Fix**: Run `rls-audit-logging.sql` to install audit system.

### Slack Webhook Failing

**Check**: Test webhook manually:

```bash
curl -X POST -H 'Content-Type: application/json' \
  -d '{"text":"Test"}' \
  YOUR_WEBHOOK_URL
```

**Fix**: Verify webhook URL is correct and active.

### Cron Not Running

**Check**: Verify cron job exists:

```sql
SELECT * FROM cron.job;
```

**Fix**: Re-run the cron schedule SQL.

### Function Errors

**Check**: View logs for error details:

```bash
supabase functions logs security-alerts
```

**Fix**: Common issues:
- Missing secrets → Set all required environment variables
- Database errors → Verify service role key
- Network errors → Check Slack webhook URL

## Performance

- **Execution Time**: ~500ms average
- **Memory Usage**: ~50MB
- **Cost**: Free tier covers ~100K invocations/month
- **Database Impact**: Minimal (indexed queries)

## Security

- Uses service role key (keep secret!)
- Cron secret prevents unauthorized invocations
- RLS policies protect audit log access
- Webhook URLs should be kept confidential
- Email API keys should be rotated regularly

## Maintenance

### Weekly
- Review function logs for errors
- Check alert processing trends

### Monthly
- Update dependencies
- Review and adjust thresholds
- Archive old processing logs

### As Needed
- Rotate API keys
- Update webhook URLs
- Deploy code updates

## Support

For issues or questions:

1. Check the [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
2. Review function logs
3. Test manually with `supabase functions invoke`
4. Check Supabase dashboard for errors

## License

Part of the RevPilot security monitoring system.

## Version

1.0.0 - Initial release

---

**Need help?** See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions.
