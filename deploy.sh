#!/bin/bash

# ============================================
# Stripe Analytics SaaS - Production Deployment Script
# ============================================
# This script prepares and deploys the application to production
# Run: chmod +x deploy.sh && ./deploy.sh
# ============================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Stripe Analytics - Deployment${NC}"
echo -e "${BLUE}================================${NC}\n"

# ============================================
# 1. PRE-FLIGHT CHECKS
# ============================================
echo -e "${YELLOW}[1/8] Running pre-flight checks...${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ Error: package.json not found. Are you in the project root?${NC}"
  exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}⚠️  node_modules not found. Installing dependencies...${NC}"
  npm install
fi

# Check for required files
REQUIRED_FILES=("next.config.js" "vercel.json" ".env.example")
for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo -e "${RED}❌ Error: Required file $file not found${NC}"
    exit 1
  fi
done

echo -e "${GREEN}✅ Pre-flight checks passed${NC}\n"

# ============================================
# 2. ENVIRONMENT VARIABLE CHECK
# ============================================
echo -e "${YELLOW}[2/8] Checking environment variables...${NC}"

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
  echo -e "${RED}❌ .env.production not found!${NC}"
  echo -e "${YELLOW}Creating .env.production template from .env.example...${NC}"
  cp .env.example .env.production
  echo -e "${RED}⚠️  IMPORTANT: Edit .env.production with your production values before deploying!${NC}"
  echo -e "${YELLOW}Opening .env.production for editing...${NC}"
  ${EDITOR:-nano} .env.production
fi

# Verify critical environment variables
CRITICAL_VARS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_KEY"
  "STRIPE_SECRET_KEY"
  "STRIPE_WEBHOOK_SECRET"
  "ENCRYPTION_KEY"
  "CRON_SECRET"
  "NEXT_PUBLIC_APP_URL"
)

echo -e "${YELLOW}Checking critical environment variables in .env.production...${NC}"
MISSING_VARS=()

for var in "${CRITICAL_VARS[@]}"; do
  if ! grep -q "^${var}=" .env.production || grep -q "^${var}=.*your-.*here" .env.production || grep -q "^${var}=.*xxxxx" .env.production; then
    MISSING_VARS+=("$var")
  fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
  echo -e "${RED}❌ Missing or incomplete environment variables:${NC}"
  for var in "${MISSING_VARS[@]}"; do
    echo -e "${RED}   - $var${NC}"
  done
  echo -e "\n${YELLOW}Please configure these variables in .env.production before deploying${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Environment variables configured${NC}\n"

# ============================================
# 3. GENERATE MISSING SECRETS
# ============================================
echo -e "${YELLOW}[3/8] Checking for missing secrets...${NC}"

# Check if ENCRYPTION_KEY needs to be generated
if grep -q "ENCRYPTION_KEY=your-64-character-hex-encryption-key-here" .env.production 2>/dev/null; then
  echo -e "${YELLOW}Generating ENCRYPTION_KEY...${NC}"
  ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  sed -i.bak "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=${ENCRYPTION_KEY}/" .env.production
  echo -e "${GREEN}✅ ENCRYPTION_KEY generated${NC}"
fi

# Check if CRON_SECRET needs to be generated
if grep -q "CRON_SECRET=your-cron-secret-here" .env.production 2>/dev/null; then
  echo -e "${YELLOW}Generating CRON_SECRET...${NC}"
  CRON_SECRET=$(openssl rand -base64 32)
  sed -i.bak "s/CRON_SECRET=.*/CRON_SECRET=${CRON_SECRET}/" .env.production
  echo -e "${GREEN}✅ CRON_SECRET generated${NC}"
fi

echo -e "${GREEN}✅ All secrets configured${NC}\n"

# ============================================
# 4. RUN TESTS
# ============================================
echo -e "${YELLOW}[4/8] Running tests...${NC}"

if npm run test --if-present; then
  echo -e "${GREEN}✅ Tests passed${NC}\n"
else
  echo -e "${RED}❌ Tests failed${NC}"
  read -p "Continue deployment anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# ============================================
# 5. BUILD CHECK
# ============================================
echo -e "${YELLOW}[5/8] Testing production build...${NC}"

# Load environment variables for build
export $(cat .env.production | grep -v '^#' | xargs)

if npm run build; then
  echo -e "${GREEN}✅ Build successful${NC}\n"
else
  echo -e "${RED}❌ Build failed. Please fix errors before deploying.${NC}"
  exit 1
fi

# ============================================
# 6. GIT STATUS CHECK
# ============================================
echo -e "${YELLOW}[6/8] Checking Git status...${NC}"

if [ -n "$(git status --porcelain)" ]; then
  echo -e "${YELLOW}⚠️  Uncommitted changes detected${NC}"
  git status --short

  read -p "Commit these changes? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter commit message: " commit_message
    git add .
    git commit -m "${commit_message:-chore: prepare for production deployment}"
    echo -e "${GREEN}✅ Changes committed${NC}"
  fi
else
  echo -e "${GREEN}✅ Working directory clean${NC}"
fi

echo ""

# ============================================
# 7. DEPLOYMENT PLATFORM SELECTION
# ============================================
echo -e "${YELLOW}[7/8] Select deployment platform:${NC}"
echo "1) Vercel (recommended)"
echo "2) Docker"
echo "3) Manual (skip deployment, just prepare)"
read -p "Enter choice (1-3): " platform_choice

case $platform_choice in
  1)
    echo -e "\n${BLUE}Deploying to Vercel...${NC}\n"

    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
      echo -e "${YELLOW}Vercel CLI not found. Installing...${NC}"
      npm install -g vercel
    fi

    # Check if already linked
    if [ ! -d ".vercel" ]; then
      echo -e "${YELLOW}Linking to Vercel project...${NC}"
      vercel link
    fi

    # Deploy to production
    echo -e "${BLUE}Deploying to production...${NC}"
    vercel --prod

    echo -e "\n${GREEN}✅ Deployed to Vercel!${NC}"
    echo -e "${YELLOW}Don't forget to:${NC}"
    echo -e "  1. Configure environment variables in Vercel dashboard"
    echo -e "  2. Run database migrations in production Supabase"
    echo -e "  3. Update Stripe webhook URL to your production domain"
    ;;

  2)
    echo -e "\n${BLUE}Building Docker image...${NC}\n"

    # Check if Dockerfile exists, if not create one
    if [ ! -f "Dockerfile" ]; then
      echo -e "${YELLOW}Creating Dockerfile...${NC}"
      cat > Dockerfile << 'EOF'
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
EOF
    fi

    docker build -t stripe-analytics:latest .

    echo -e "\n${GREEN}✅ Docker image built!${NC}"
    echo -e "${YELLOW}To run:${NC}"
    echo -e "  docker run -p 3000:3000 --env-file .env.production stripe-analytics:latest"
    ;;

  3)
    echo -e "\n${GREEN}✅ Application prepared for deployment${NC}"
    echo -e "${YELLOW}Manual deployment checklist:${NC}"
    echo -e "  1. Upload files to your hosting platform"
    echo -e "  2. Configure environment variables"
    echo -e "  3. Run: npm install && npm run build && npm start"
    ;;

  *)
    echo -e "${RED}Invalid choice${NC}"
    exit 1
    ;;
esac

# ============================================
# 8. POST-DEPLOYMENT CHECKLIST
# ============================================
echo -e "\n${YELLOW}[8/8] Post-Deployment Checklist:${NC}"
echo -e "${BLUE}================================${NC}"
echo ""
echo -e "📋 ${YELLOW}Required Steps:${NC}"
echo -e "  ${BLUE}1.${NC} Configure all environment variables in your hosting platform"
echo -e "  ${BLUE}2.${NC} Run database migrations in production Supabase:"
echo -e "     ${GREEN}psql \$DATABASE_URL -f migrations/003_stripe_analytics.sql${NC}"
echo -e "  ${BLUE}3.${NC} Configure Stripe webhooks:"
echo -e "     ${GREEN}URL:${NC} https://yourdomain.com/api/webhooks/stripe-billing"
echo -e "     ${GREEN}Events:${NC} checkout.session.completed, customer.subscription.*, invoice.*"
echo -e "  ${BLUE}4.${NC} Update NEXT_PUBLIC_APP_URL to your production domain"
echo -e "  ${BLUE}5.${NC} Test health endpoint: https://yourdomain.com/api/health"
echo ""
echo -e "🔐 ${YELLOW}Security:${NC}"
echo -e "  ${BLUE}1.${NC} Verify all API keys are production (sk_live_, pk_live_)"
echo -e "  ${BLUE}2.${NC} Test webhook signature verification"
echo -e "  ${BLUE}3.${NC} Verify CRON endpoint is protected with CRON_SECRET"
echo -e "  ${BLUE}4.${NC} Enable Sentry error tracking"
echo -e "  ${BLUE}5.${NC} Configure Upstash Redis for rate limiting"
echo ""
echo -e "✅ ${YELLOW}Verification:${NC}"
echo -e "  ${BLUE}1.${NC} Test user signup flow"
echo -e "  ${BLUE}2.${NC} Test Stripe Connect integration"
echo -e "  ${BLUE}3.${NC} Test subscription checkout"
echo -e "  ${BLUE}4.${NC} Verify webhook delivery in Stripe Dashboard"
echo -e "  ${BLUE}5.${NC} Check Sentry for errors"
echo ""
echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}🎉 Deployment script completed!${NC}"
echo -e "${BLUE}================================${NC}\n"
echo -e "For detailed deployment guide, see: ${YELLOW}DEPLOYMENT.md${NC}"
echo -e "For production checklist, see: ${YELLOW}PRODUCTION_CHECKLIST.md${NC}\n"
