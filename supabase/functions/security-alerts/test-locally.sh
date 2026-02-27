#!/bin/bash

# Local testing script for security-alerts Edge Function
# This script helps you test the function locally before deploying

set -e

echo "🧪 Testing Security Alerts Edge Function Locally"
echo "================================================"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install it with:"
    echo "   npm install -g supabase"
    exit 1
fi

echo "✓ Supabase CLI found"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating template..."
    cat > .env << EOF
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
ALERT_EMAIL=security@yourcompany.com
SENDGRID_API_KEY=SG.your_sendgrid_key_here
CRON_SECRET=your_random_secret_here
EOF
    echo "❌ Please edit .env file with your credentials and run again"
    exit 1
fi

echo "✓ Environment file found"

# Load environment variables
export $(cat .env | xargs)

# Verify required variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] || [ -z "$SLACK_WEBHOOK_URL" ]; then
    echo "❌ Missing required environment variables in .env file"
    echo "   Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SLACK_WEBHOOK_URL"
    exit 1
fi

echo "✓ Required environment variables set"
echo ""

# Start Supabase locally (if not already running)
echo "📦 Starting local Supabase..."
supabase start 2>/dev/null || echo "Supabase already running"
echo ""

# Serve the function locally
echo "🚀 Starting Edge Function locally..."
echo "   Function will be available at: http://localhost:54321/functions/v1/security-alerts"
echo ""
echo "   Press Ctrl+C to stop"
echo ""

supabase functions serve security-alerts --env-file .env --no-verify-jwt
