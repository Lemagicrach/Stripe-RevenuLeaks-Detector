# Fix Next.js Issues - PowerShell Script
# Run this with: 

Write-Host "🔧 Fixing Next.js Issues..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill all Node processes
Write-Host "1️⃣ Stopping all Node.js processes..." -ForegroundColor Yellow
try {
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "   ✅ Node processes stopped" -ForegroundColor Green
} catch {
    Write-Host "   ℹ️ No Node processes to stop" -ForegroundColor Gray
}

Start-Sleep -Seconds 1

# Step 2: Delete .next folder
Write-Host ""
Write-Host "2️⃣ Cleaning .next directory..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item -Path ".next" -Recurse -Force
    Write-Host "   ✅ .next directory cleaned" -ForegroundColor Green
} else {
    Write-Host "   ℹ️ .next directory doesn't exist" -ForegroundColor Gray
}

# Step 3: Update next.config.js
Write-Host ""
Write-Host "3️⃣ Updating next.config.js..." -ForegroundColor Yellow

$nextConfig = @"
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Image configuration (updated for Next.js 16)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ebayimg.com',
      },
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com',
      },
      {
        protocol: 'https',
        hostname: 'i5.walmartimages.com',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
    ],
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

module.exports = nextConfig
"@

Set-Content -Path "next.config.js" -Value $nextConfig
Write-Host "   ✅ next.config.js updated" -ForegroundColor Green

# Step 4: Check if date-fns is installed
Write-Host ""
Write-Host "4️⃣ Checking dependencies..." -ForegroundColor Yellow

$packageJson = Get-Content "package.json" | ConvertFrom-Json
if ($packageJson.dependencies.'date-fns') {
    Write-Host "   ✅ date-fns already installed" -ForegroundColor Green
} else {
    Write-Host "   📦 Installing date-fns..." -ForegroundColor Yellow
    npm install date-fns
    Write-Host "   ✅ date-fns installed" -ForegroundColor Green
}

# Step 5: Verify environment variables
Write-Host ""
Write-Host "5️⃣ Checking environment variables..." -ForegroundColor Yellow

if (Test-Path ".env.local") {
    $envContent = Get-Content ".env.local" -Raw
    
    $required = @(
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_KEY",
        "STRIPE_SECRET_KEY",
        "STRIPE_CLIENT_ID",
        "ENCRYPTION_KEY",
        "CRON_SECRET"
    )
    
    $missing = @()
    foreach ($var in $required) {
        if (-not ($envContent -match "$var=")) {
            $missing += $var
        }
    }
    
    if ($missing.Count -eq 0) {
        Write-Host "   ✅ All required variables present" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ Missing variables:" -ForegroundColor Yellow
        foreach ($var in $missing) {
            Write-Host "      - $var" -ForegroundColor Red
        }
    }
} else {
    Write-Host "   ⚠️ .env.local not found!" -ForegroundColor Red
    Write-Host "      Create it with the required variables" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "✅ All fixes applied!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Make sure your .env.local has all required variables" -ForegroundColor White
Write-Host "2. Run: npm run dev" -ForegroundColor White
Write-Host "3. Visit: http://localhost:3000 (or 3002 if 3000 is in use)" -ForegroundColor White
Write-Host ""