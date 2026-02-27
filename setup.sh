#!/bin/bash

# ==================================
# 🚀 Stripe Analytics SaaS - Quick Setup
# ==================================
# This script helps you set up your development environment

set -e

echo "🚀 Setting up Stripe Analytics SaaS..."
echo ""

# Check if .env.local exists
if [ -f ".env.local" ]; then
    echo "✅ .env.local already exists"
    read -p "Do you want to regenerate security keys? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping key generation..."
    else
        REGENERATE_KEYS=true
    fi
else
    echo "📝 Creating .env.local from template..."
    cp .env.local .env.local.backup 2>/dev/null || true
    REGENERATE_KEYS=true
fi

# Generate secure keys if needed
if [ "$REGENERATE_KEYS" = true ]; then
    echo ""
    echo "🔐 Generating secure keys..."

    # Generate encryption key
    ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    echo "✅ Generated ENCRYPTION_KEY: ${ENCRYPTION_KEY:0:16}..."

    # Generate CRON secret
    CRON_SECRET=$(openssl rand -base64 32)
    echo "✅ Generated CRON_SECRET: ${CRON_SECRET:0:16}..."

    # Update .env.local with generated keys
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENCRYPTION_KEY|g" .env.local
        sed -i '' "s|CRON_SECRET=.*|CRON_SECRET=$CRON_SECRET|g" .env.local
    else
        # Linux
        sed -i "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENCRYPTION_KEY|g" .env.local
        sed -i "s|CRON_SECRET=.*|CRON_SECRET=$CRON_SECRET|g" .env.local
    fi

    echo "✅ Updated .env.local with generated keys"
fi

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. 🗄️  Set up your Supabase project:"
echo "   - Go to https://app.supabase.com"
echo "   - Create a new project"
echo "   - Run the SQL migrations from /migrations folder"
echo "   - Get your API keys from Settings > API"
echo "   - Update .env.local with your Supabase credentials"
echo ""
echo "2. 💳 Set up your Stripe account:"
echo "   - Go to https://dashboard.stripe.com"
echo "   - Get your API keys from Developers > API keys"
echo "   - Create a Connect application in Settings > Connect > Applications"
echo "   - Update .env.local with your Stripe credentials"
echo ""
echo "3. 🚀 Run the development server:"
echo "   npm run dev"
echo ""
echo "4. 🌐 Open your browser:"
echo "   http://localhost:3000"
echo ""
echo "📚 For more help, check:"
echo "   - QUICK_START.md"
echo "   - TROUBLESHOOTING.md"
echo "   - DATABASE_SETUP_INSTRUCTIONS.md"
echo ""
echo "🎉 Happy coding!"
