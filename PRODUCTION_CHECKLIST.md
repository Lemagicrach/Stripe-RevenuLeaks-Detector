# Production Deployment Checklist

This checklist ensures your Stripe Analytics SaaS application is production-ready and secure.

## ✅ Pre-Deployment Checklist

### 🔐 Security

- [ ] **Environment Variables**: All required environment variables are set in production
  - [ ] `ENCRYPTION_KEY` - Generated using `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  - [ ] `CRON_SECRET` - Generated using `openssl rand -base64 32`
  - [ ] `STRIPE_WEBHOOK_SECRET` - From Stripe Dashboard
  - [ ] `STRIPE_SECRET_KEY` - Production key (starts with `sk_live_`)
  - [ ] `SUPABASE_SERVICE_KEY` - Production service role key

- [ ] **API Keys Rotation**: All test keys replaced with production keys
- [ ] **CORS Configuration**: Properly configured in middleware
- [ ] **Rate Limiting**: Upstash Redis configured for production rate limiting
- [ ] **Row Level Security**: Enabled on all Supabase tables
- [ ] **Webhook Signature Verification**: Enabled and tested

### 📊 Monitoring & Logging

- [ ] **Sentry Configuration**:
  - [ ] `NEXT_PUBLIC_SENTRY_DSN` configured
  - [ ] Source maps uploaded
  - [ ] Error tracking tested

- [ ] **Health Check Endpoint**: `/api/health` accessible
- [ ] **Vercel Analytics**: Configured and active
- [ ] **Log Aggregation**: Centralized logging setup

### 🗄️ Database

- [ ] **Migrations Run**: All SQL migrations applied to production database
  ```bash
  # Run migrations
  psql $DATABASE_URL -f migrations/003_stripe_analytics.sql
  ```
- [ ] **Indexes Created**: All performance indexes in place
- [ ] **Backups Configured**: Automated backups enabled in Supabase
- [ ] **Connection Pooling**: Properly configured

### 🎯 Stripe Configuration

- [ ] **Webhook Endpoints**: Configured in Stripe Dashboard
  - Production URL: `https://yourdomain.com/api/webhooks/stripe`
  - Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`

- [ ] **Stripe Connect**:
  - [ ] OAuth settings configured
  - [ ] Redirect URIs whitelisted
  - [ ] Scopes set to `read_only`

- [ ] **Price IDs**: Production price IDs set in environment variables
- [ ] **Test Mode**: Disabled in production

### 🚀 Performance

- [ ] **Caching Strategy**:
  - [ ] Redis caching implemented for frequent queries
  - [ ] Static assets cached with proper headers

- [ ] **Database Optimization**:
  - [ ] Queries using indexes
  - [ ] No N+1 query problems
  - [ ] Connection pooling enabled

- [ ] **CDN Configuration**: Static assets served via CDN
- [ ] **Image Optimization**: Next.js Image component used throughout

### 🧪 Testing

- [ ] **Unit Tests**: Run and passing
  ```bash
  npm test
  ```
- [ ] **Integration Tests**: Stripe webhooks tested
- [ ] **Load Testing**: Application tested under expected load
- [ ] **Error Scenarios**: Error boundaries working correctly

### 📝 Documentation

- [ ] **README Updated**: Current and accurate
- [ ] **API Documentation**: Endpoints documented
- [ ] **Deployment Guide**: Complete deployment instructions
- [ ] **Runbook**: Incident response procedures documented

### 🔄 CI/CD

- [ ] **Build Pipeline**: Automated builds on main branch
- [ ] **Test Pipeline**: Tests run on every PR
- [ ] **Deployment Pipeline**: Automated deployment to production
- [ ] **Rollback Plan**: Documented and tested

## 🚨 Critical Configuration

### Environment Variables Priority

1. **MUST HAVE** (Application won't work without these):
   ```bash
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_KEY
   STRIPE_SECRET_KEY
   STRIPE_WEBHOOK_SECRET
   ENCRYPTION_KEY
   CRON_SECRET
   NEXT_PUBLIC_APP_URL
   ```

2. **HIGHLY RECOMMENDED** (Production features):
   ```bash
   NEXT_PUBLIC_SENTRY_DSN
   UPSTASH_REDIS_REST_URL
   UPSTASH_REDIS_REST_TOKEN
   SENDGRID_API_KEY
   STRIPE_CLIENT_ID
   ```

3. **OPTIONAL** (Analytics and extras):
   ```bash
   NEXT_PUBLIC_POSTHOG_KEY
   NEXT_PUBLIC_GA_ID
   ```

## 📋 Post-Deployment

### Verification Steps

1. **Health Check**:
   ```bash
   curl https://yourdomain.com/api/health
   # Should return 200 with healthy status
   ```

2. **Authentication Flow**:
   - [ ] Sign up works
   - [ ] Sign in works
   - [ ] Password reset works

3. **Stripe Integration**:
   - [ ] Connect Stripe account flow works
   - [ ] Webhooks being received
   - [ ] Metrics calculation working

4. **Monitoring**:
   - [ ] Sentry receiving events
   - [ ] Logs appearing in dashboard
   - [ ] Metrics being tracked

### First Week Monitoring

- [ ] Monitor error rates in Sentry
- [ ] Check database performance
- [ ] Review API response times
- [ ] Monitor rate limiting effectiveness
- [ ] Check webhook delivery success rate

## 🔧 Troubleshooting

### Common Issues

1. **Webhooks Not Working**:
   - Verify webhook secret matches Stripe Dashboard
   - Check webhook endpoint is publicly accessible
   - Review webhook signature verification logs

2. **Database Connection Issues**:
   - Check connection string is correct
   - Verify IP allowlist in Supabase
   - Check connection pool settings

3. **Encryption Errors**:
   - Ensure ENCRYPTION_KEY is exactly 64 hex characters
   - Verify key matches between environments when migrating data

4. **Rate Limiting Issues**:
   - Check Upstash Redis connectivity
   - Verify rate limit thresholds are appropriate
   - Review rate limit bypass for health checks

## 📞 Support Contacts

- **Technical Issues**: [Your support email]
- **Security Issues**: [Your security email]
- **On-Call**: [Your on-call system]

## 🔄 Regular Maintenance

### Weekly
- [ ] Review error logs in Sentry
- [ ] Check database performance metrics
- [ ] Review API usage patterns

### Monthly
- [ ] Update dependencies
- [ ] Review security advisories
- [ ] Check backup restoration process
- [ ] Review and update documentation

### Quarterly
- [ ] Security audit
- [ ] Performance optimization review
- [ ] Disaster recovery drill
- [ ] Update runbooks

---

**Last Updated**: [Date]
**Reviewed By**: [Name]
**Next Review**: [Date]
