/**
 * Supabase Edge Function: Security Alerts
 * 
 * This function monitors RLS audit logs and sends real-time alerts to Slack
 * when suspicious activity is detected.
 * 
 * Schedule: Runs every 5 minutes via Supabase cron
 * 
 * Environment Variables Required:
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for database access
 * - SLACK_WEBHOOK_URL: Slack incoming webhook URL
 * - ALERT_EMAIL: Email address for critical alerts (optional)
 * - SENDGRID_API_KEY: SendGrid API key for email alerts (optional)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// Types
interface Alert {
  alert_id: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  message: string
  user_email: string
  created_at: string
}

interface ThreatInfo {
  threat_level: string
  user_email: string
  recent_blocked_count: number
  last_attempt: string
  attempted_tables: string[]
}

interface SlackMessage {
  text: string
  blocks: any[]
}

// Configuration
const config = {
  supabaseUrl: Deno.env.get('SUPABASE_URL')!,
  supabaseKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  slackWebhook: Deno.env.get('SLACK_WEBHOOK_URL')!,
  alertEmail: Deno.env.get('ALERT_EMAIL'),
  sendgridKey: Deno.env.get('SENDGRID_API_KEY'),
}

// Initialize Supabase client
const supabase = createClient(config.supabaseUrl, config.supabaseKey)

/**
 * Main handler function
 */
serve(async (req) => {
  try {
    console.log('Security alerts function started')

    // Verify request is authorized (optional - for manual triggers)
    const authHeader = req.headers.get('authorization')
    const cronSecret = Deno.env.get('CRON_SECRET')
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('Unauthorized request')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Fetch alerts from database
    const alerts = await fetchAlerts()
    console.log(`Found ${alerts.length} alerts`)

    // Fetch current threats
    const threats = await fetchCurrentThreats()
    console.log(`Found ${threats.length} active threats`)

    // Process and send alerts
    let sentCount = 0
    
    if (alerts.length > 0 || threats.length > 0) {
      // Send to Slack
      await sendSlackNotification(alerts, threats)
      sentCount++

      // Send email for critical alerts
      const criticalAlerts = alerts.filter(a => a.severity === 'critical')
      if (criticalAlerts.length > 0 && config.alertEmail && config.sendgridKey) {
        await sendEmailNotification(criticalAlerts, threats)
        sentCount++
      }

      // Log alert processing
      await logAlertProcessing(alerts, threats)
    }

    console.log(`Processed ${alerts.length} alerts and ${threats.length} threats`)

    return new Response(
      JSON.stringify({
        success: true,
        alerts_processed: alerts.length,
        threats_detected: threats.length,
        notifications_sent: sentCount,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in security alerts function:', error)
    
    // Send error notification to Slack
    await sendErrorNotification(error as Error)

    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: (error as Error).message 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})

/**
 * Fetch alerts from the database
 */
async function fetchAlerts(): Promise<Alert[]> {
  const { data, error } = await supabase.rpc('get_alerts_for_notification')

  if (error) {
    console.error('Error fetching alerts:', error)
    throw new Error(`Failed to fetch alerts: ${error.message}`)
  }

  return data || []
}

/**
 * Fetch current threats from the database
 */
async function fetchCurrentThreats(): Promise<ThreatInfo[]> {
  const { data, error } = await supabase.rpc('get_current_threats')

  if (error) {
    console.error('Error fetching threats:', error)
    throw new Error(`Failed to fetch threats: ${error.message}`)
  }

  return data || []
}

/**
 * Send notification to Slack
 */
async function sendSlackNotification(alerts: Alert[], threats: ThreatInfo[]): Promise<void> {
  if (!config.slackWebhook) {
    console.log('Slack webhook not configured, skipping Slack notification')
    return
  }

  const message = buildSlackMessage(alerts, threats)

  const response = await fetch(config.slackWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Slack notification failed: ${response.status} - ${errorText}`)
  }

  console.log('Slack notification sent successfully')
}

/**
 * Build Slack message with rich formatting
 */
function buildSlackMessage(alerts: Alert[], threats: ThreatInfo[]): SlackMessage {
  const blocks: any[] = []

  // Header
  const criticalCount = alerts.filter(a => a.severity === 'critical').length
  const highCount = alerts.filter(a => a.severity === 'high').length
  const threatCount = threats.filter(t => t.threat_level === 'CRITICAL' || t.threat_level === 'HIGH').length

  const emoji = criticalCount > 0 || threatCount > 0 ? '🚨' : '⚠️'
  const urgency = criticalCount > 0 || threatCount > 0 ? 'URGENT' : 'Warning'

  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: `${emoji} ${urgency}: Security Alerts Detected`,
      emoji: true
    }
  })

  // Summary
  blocks.push({
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `*Critical Alerts:*\n${criticalCount}`
      },
      {
        type: 'mrkdwn',
        text: `*High Alerts:*\n${highCount}`
      },
      {
        type: 'mrkdwn',
        text: `*Active Threats:*\n${threatCount}`
      },
      {
        type: 'mrkdwn',
        text: `*Time:*\n${new Date().toLocaleString()}`
      }
    ]
  })

  blocks.push({ type: 'divider' })

  // Critical and High Alerts
  const priorityAlerts = alerts.filter(a => a.severity === 'critical' || a.severity === 'high')
  
  if (priorityAlerts.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*🔴 Priority Alerts:*'
      }
    })

    priorityAlerts.slice(0, 5).forEach(alert => {
      const severityEmoji = alert.severity === 'critical' ? '🔴' : '🟠'
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${severityEmoji} *${alert.severity.toUpperCase()}*\n${alert.message}\n_User: ${alert.user_email}_\n_Time: ${new Date(alert.created_at).toLocaleString()}_`
        }
      })
    })

    if (priorityAlerts.length > 5) {
      blocks.push({
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: `_...and ${priorityAlerts.length - 5} more alerts_`
        }]
      })
    }

    blocks.push({ type: 'divider' })
  }

  // Active Threats
  const highThreats = threats.filter(t => t.threat_level === 'CRITICAL' || t.threat_level === 'HIGH')
  
  if (highThreats.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*⚡ Active Threats:*'
      }
    })

    highThreats.slice(0, 3).forEach(threat => {
      const levelEmoji = threat.threat_level === 'CRITICAL' ? '🔴' : '🟠'
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${levelEmoji} *${threat.threat_level}*\n` +
                `User: ${threat.user_email}\n` +
                `Blocked Attempts: ${threat.recent_blocked_count}\n` +
                `Tables: ${threat.attempted_tables.join(', ')}\n` +
                `Last Attempt: ${new Date(threat.last_attempt).toLocaleString()}`
        }
      })
    })

    if (highThreats.length > 3) {
      blocks.push({
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: `_...and ${highThreats.length - 3} more threats_`
        }]
      })
    }

    blocks.push({ type: 'divider' })
  }

  // Actions
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Recommended Actions:*\n' +
            '• Review user accounts with multiple blocked attempts\n' +
            '• Check application logs for errors\n' +
            '• Verify RLS policies are correctly configured\n' +
            '• Consider rate-limiting or blocking suspicious users'
    }
  })

  // Add button to view full dashboard
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '🔍 View Security Dashboard',
          emoji: true
        },
        url: `${config.supabaseUrl.replace('supabase.co', 'supabase.co')}/project/_/database/tables`,
        style: 'primary'
      }
    ]
  })

  return {
    text: `${emoji} Security Alert: ${criticalCount} critical, ${highCount} high severity alerts detected`,
    blocks
  }
}

/**
 * Send email notification for critical alerts
 */
async function sendEmailNotification(alerts: Alert[], threats: ThreatInfo[]): Promise<void> {
  if (!config.sendgridKey || !config.alertEmail) {
    console.log('Email notification not configured, skipping')
    return
  }

  const emailBody = buildEmailBody(alerts, threats)

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.sendgridKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email: config.alertEmail }],
        subject: `🚨 CRITICAL: Security Alerts Detected - ${new Date().toLocaleString()}`
      }],
      from: {
        email: 'security@revpilot.app',
        name: 'RevPilot Security'
      },
      content: [{
        type: 'text/html',
        value: emailBody
      }]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Email notification failed: ${response.status} - ${errorText}`)
  }

  console.log('Email notification sent successfully')
}

/**
 * Build HTML email body
 */
function buildEmailBody(alerts: Alert[], threats: ThreatInfo[]): string {
  const criticalCount = alerts.filter(a => a.severity === 'critical').length
  const highThreats = threats.filter(t => t.threat_level === 'CRITICAL' || t.threat_level === 'HIGH')

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .alert { background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 10px 0; }
        .threat { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 10px 0; }
        .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f3f4f6; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🚨 CRITICAL SECURITY ALERT</h1>
        <p>${criticalCount} critical alerts detected at ${new Date().toLocaleString()}</p>
      </div>
      
      <div class="content">
        <h2>Summary</h2>
        <table>
          <tr>
            <th>Metric</th>
            <th>Count</th>
          </tr>
          <tr>
            <td>Critical Alerts</td>
            <td style="color: #dc2626; font-weight: bold;">${criticalCount}</td>
          </tr>
          <tr>
            <td>High Priority Threats</td>
            <td style="color: #f59e0b; font-weight: bold;">${highThreats.length}</td>
          </tr>
        </table>

        <h2>Critical Alerts</h2>
  `

  alerts.forEach(alert => {
    html += `
      <div class="alert">
        <strong>${alert.severity.toUpperCase()}</strong><br>
        ${alert.message}<br>
        <small>User: ${alert.user_email} | Time: ${new Date(alert.created_at).toLocaleString()}</small>
      </div>
    `
  })

  if (highThreats.length > 0) {
    html += `<h2>Active Threats</h2>`
    
    highThreats.forEach(threat => {
      html += `
        <div class="threat">
          <strong>${threat.threat_level}</strong><br>
          User: ${threat.user_email}<br>
          Blocked Attempts: ${threat.recent_blocked_count}<br>
          Tables: ${threat.attempted_tables.join(', ')}<br>
          <small>Last Attempt: ${new Date(threat.last_attempt).toLocaleString()}</small>
        </div>
      `
    })
  }

  html += `
        <h2>Recommended Actions</h2>
        <ul>
          <li>Immediately review the affected user accounts</li>
          <li>Check application logs for related errors</li>
          <li>Verify RLS policies are correctly configured</li>
          <li>Consider temporarily blocking suspicious users</li>
          <li>Review recent code deployments for bugs</li>
        </ul>
      </div>

      <div class="footer">
        <p>This is an automated security alert from RevPilot.</p>
        <p>Do not reply to this email. For support, contact your security team.</p>
      </div>
    </body>
    </html>
  `

  return html
}

/**
 * Log alert processing to database
 */
async function logAlertProcessing(alerts: Alert[], threats: ThreatInfo[]): Promise<void> {
  const { error } = await supabase
    .from('alert_processing_log')
    .insert({
      processed_at: new Date().toISOString(),
      alerts_count: alerts.length,
      threats_count: threats.length,
      critical_count: alerts.filter(a => a.severity === 'critical').length,
      high_count: alerts.filter(a => a.severity === 'high').length,
      notifications_sent: true
    })

  if (error) {
    console.error('Error logging alert processing:', error)
    // Don't throw - this is non-critical
  }
}

/**
 * Send error notification to Slack
 */
async function sendErrorNotification(error: Error): Promise<void> {
  if (!config.slackWebhook) return

  try {
    await fetch(config.slackWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '❌ Security Alerts Function Error',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*❌ Error in Security Alerts Function*\n\`\`\`${error.message}\`\`\`\n_Time: ${new Date().toLocaleString()}_`
            }
          }
        ]
      })
    })
  } catch (notifyError) {
    console.error('Failed to send error notification:', notifyError)
  }
}
