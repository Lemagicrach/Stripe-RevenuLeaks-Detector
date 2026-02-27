#!/bin/bash

# ============================================
# Pre-Deployment Validation Script
# ============================================
# Validates your setup before production deployment
# Run: chmod +x pre-deploy-check.sh && ./pre-deploy-check.sh
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Pre-Deployment Validation Script     ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}\n"

# ============================================
# 1. Environment Variables Check
# ============================================
echo -e "${BLUE}[1/7] Checking Environment Variables...${NC}"

if [ ! -f ".env.production" ]; then
  echo -e "${RED}  ❌ .env.production not found${NC}"
  ((ERRORS++))
else
  # Critical variables
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

  for var in "${CRITICAL_VARS[@]}"; do
    if ! grep -q "^${var}=" .env.production 2>/dev/null; then
      echo -e "${RED}  ❌ Missing: $var${NC}"
      ((ERRORS++))
    elif grep -q "^${var}=.*your-.*here" .env.production || grep -q "^${var}=.*xxxxx" .env.production; then
      echo -e "${RED}  ❌ Not configured: $var${NC}"
      ((ERRORS++))
    else
      echo -e "${GREEN}  ✅ $var configured${NC}"
    fi
  done

  # Check Stripe keys are production keys
  if grep -q "STRIPE_SECRET_KEY=sk_test_" .env.production; then
    echo -e "${RED}  ❌ Using Stripe TEST key - must use LIVE key for production${NC}"
    ((ERRORS++))
  fi

  if grep -q "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_" .env.production; then
    echo -e "${RED}  ❌ Using Stripe TEST publishable key - must use LIVE key${NC}"
    ((ERRORS++))
  fi

  # Check encryption key length
  ENCRYPTION_KEY=$(grep "^ENCRYPTION_KEY=" .env.production | cut -d '=' -f2)
  if [ ${#ENCRYPTION_KEY} -ne 64 ]; then
    echo -e "${RED}  ❌ ENCRYPTION_KEY must be exactly 64 characters (32 bytes hex)${NC}"
    ((ERRORS++))
  fi

  # Recommended variables
  RECOMMENDED_VARS=(
    "NEXT_PUBLIC_SENTRY_DSN"
    "UPSTASH_REDIS_REST_URL"
    "UPSTASH_REDIS_REST_TOKEN"
    "SENDGRID_API_KEY"
  )

  echo -e "\n${YELLOW}Recommended variables:${NC}"
  for var in "${RECOMMENDED_VARS[@]}"; do
    if ! grep -q "^${var}=" .env.production 2>/dev/null || grep -q "^${var}=.*xxxxx" .env.production; then
      echo -e "${YELLOW}  ⚠️  Not configured: $var${NC}"
      ((WARNINGS++))
    else
      echo -e "${GREEN}  ✅ $var configured${NC}"
    fi
  done
fi

echo ""

# ============================================
# 2. File Structure Check
# ============================================
echo -e "${BLUE}[2/7] Checking File Structure...${NC}"

REQUIRED_FILES=(
  "package.json"
  "next.config.js"
  "vercel.json"
  "middleware.ts"
  "app/layout.tsx"
  "app/api/health/route.ts"
  "app/api/webhooks/stripe-billing/route.ts"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}  ✅ $file${NC}"
  else
    echo -e "${RED}  ❌ Missing: $file${NC}"
    ((ERRORS++))
  fi
done

# Check for junk files
JUNK_FILES=(
  "console.log((i+1)+"
  'console.log(`${i+1}'
)

for file in "${JUNK_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${RED}  ❌ Junk file found: $file${NC}"
    ((ERRORS++))
  fi
done

echo ""

# ============================================
# 3. Dependencies Check
# ============================================
echo -e "${BLUE}[3/7] Checking Dependencies...${NC}"

if [ ! -d "node_modules" ]; then
  echo -e "${RED}  ❌ node_modules not found - run 'npm install'${NC}"
  ((ERRORS++))
else
  echo -e "${GREEN}  ✅ node_modules exists${NC}"

  # Check for vulnerabilities
  echo -e "${YELLOW}  Checking for vulnerabilities...${NC}"
  if npm audit --production --audit-level=high 2>&1 | grep -q "found 0 vulnerabilities"; then
    echo -e "${GREEN}  ✅ No high/critical vulnerabilities found${NC}"
  else
    echo -e "${YELLOW}  ⚠️  Security vulnerabilities found - run 'npm audit' for details${NC}"
    ((WARNINGS++))
  fi
fi

echo ""

# ============================================
# 4. Git Status Check
# ============================================
echo -e "${BLUE}[4/7] Checking Git Status...${NC}"

if [ ! -d ".git" ]; then
  echo -e "${YELLOW}  ⚠️  Not a git repository${NC}"
  ((WARNINGS++))
else
  if [ -z "$(git status --porcelain)" ]; then
    echo -e "${GREEN}  ✅ Working directory clean${NC}"
  else
    echo -e "${YELLOW}  ⚠️  Uncommitted changes detected${NC}"
    ((WARNINGS++))
  fi

  # Check current branch
  CURRENT_BRANCH=$(git branch --show-current)
  echo -e "${BLUE}  Current branch: ${CURRENT_BRANCH}${NC}"

  # Check if .env files are ignored
  if git check-ignore .env.production > /dev/null 2>&1; then
    echo -e "${GREEN}  ✅ .env.production is in .gitignore${NC}"
  else
    echo -e "${RED}  ❌ WARNING: .env.production is NOT ignored by git!${NC}"
    ((ERRORS++))
  fi
fi

echo ""

# ============================================
# 5. Build Check
# ============================================
echo -e "${BLUE}[5/7] Checking Build Configuration...${NC}"

# Check Next.js config
if grep -q "output: 'export'" next.config.js 2>/dev/null; then
  echo -e "${RED}  ❌ next.config.js has 'output: export' - not compatible with API routes${NC}"
  ((ERRORS++))
else
  echo -e "${GREEN}  ✅ Next.js config looks good${NC}"
fi

# Check vercel.json
if [ -f "vercel.json" ]; then
  if grep -q '"crons"' vercel.json; then
    echo -e "${GREEN}  ✅ CRON jobs configured in vercel.json${NC}"
  else
    echo -e "${YELLOW}  ⚠️  No CRON jobs found in vercel.json${NC}"
    ((WARNINGS++))
  fi
fi

echo ""

# ============================================
# 6. Security Check
# ============================================
echo -e "${BLUE}[6/7] Security Check...${NC}"

# Check for hardcoded secrets
echo -e "${YELLOW}  Scanning for hardcoded secrets...${NC}"
if grep -r "sk_live_" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" app lib 2>/dev/null; then
  echo -e "${RED}  ❌ Found hardcoded Stripe secret key in code!${NC}"
  ((ERRORS++))
else
  echo -e "${GREEN}  ✅ No hardcoded Stripe secrets found${NC}"
fi

# Check middleware exists
if [ -f "middleware.ts" ]; then
  echo -e "${GREEN}  ✅ middleware.ts exists${NC}"

  # Check if CRON protection is implemented
  if grep -q "CRON_SECRET" middleware.ts; then
    echo -e "${GREEN}  ✅ CRON endpoint protection found${NC}"
  else
    echo -e "${YELLOW}  ⚠️  CRON endpoint protection not found in middleware${NC}"
    ((WARNINGS++))
  fi
else
  echo -e "${RED}  ❌ middleware.ts not found${NC}"
  ((ERRORS++))
fi

# Check webhook signature verification
if grep -q "stripe.webhooks.constructEvent" app/api/webhooks/stripe-billing/route.ts 2>/dev/null; then
  echo -e "${GREEN}  ✅ Webhook signature verification implemented${NC}"
else
  echo -e "${RED}  ❌ Webhook signature verification missing${NC}"
  ((ERRORS++))
fi

echo ""

# ============================================
# 7. Database Check
# ============================================
echo -e "${BLUE}[7/7] Database Migration Check...${NC}"

MIGRATION_FILES=$(find migrations -name "*.sql" 2>/dev/null | wc -l)
SUPABASE_MIGRATIONS=$(find supabase/migrations -name "*.sql" 2>/dev/null | wc -l)

if [ $MIGRATION_FILES -gt 0 ] || [ $SUPABASE_MIGRATIONS -gt 0 ]; then
  echo -e "${GREEN}  ✅ Found $MIGRATION_FILES migration files${NC}"
  echo -e "${YELLOW}  ⚠️  Remember to run migrations in production Supabase${NC}"
  ((WARNINGS++))
else
  echo -e "${YELLOW}  ⚠️  No migration files found${NC}"
  ((WARNINGS++))
fi

echo ""

# ============================================
# Summary
# ============================================
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}             SUMMARY                    ${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}\n"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}🎉 Perfect! Your application is ready for deployment!${NC}\n"
  echo -e "${BLUE}Next steps:${NC}"
  echo -e "  1. Run: ${GREEN}./deploy.sh${NC}"
  echo -e "  2. Configure environment variables in your hosting platform"
  echo -e "  3. Run database migrations in production"
  echo -e "  4. Update Stripe webhook URL"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠️  Found ${WARNINGS} warning(s)${NC}\n"
  echo -e "${YELLOW}Your application can be deployed, but you should address these warnings.${NC}\n"
  echo -e "${BLUE}Ready to deploy?${NC}"
  echo -e "  Run: ${GREEN}./deploy.sh${NC}\n"
  exit 0
else
  echo -e "${RED}❌ Found ${ERRORS} error(s) and ${WARNINGS} warning(s)${NC}\n"
  echo -e "${RED}Please fix the errors above before deploying.${NC}\n"
  exit 1
fi
