-- migrations/004_churn_prevention.sql
-- AI-Powered Churn Prevention Assistant

-- Churn risk predictions
CREATE TABLE IF NOT EXISTS churn_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_connection_id UUID REFERENCES stripe_connections(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  
  -- Risk assessment
  risk_score DECIMAL(5,2) NOT NULL, -- 0-100
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  churn_probability DECIMAL(5,2) NOT NULL, -- 0-100
  predicted_churn_date DATE,
  
  -- Revenue impact
  mrr_at_risk DECIMAL(10,2) DEFAULT 0,
  ltv_at_risk DECIMAL(10,2) DEFAULT 0,
  
  -- Risk factors
  risk_factors JSONB DEFAULT '[]',
  -- Example: [
  --   {"factor": "payment_failure", "weight": 0.35, "description": "Failed payment 3 days ago"},
  --   {"factor": "usage_decline", "weight": 0.25, "description": "Usage down 60% this month"},
  --   {"factor": "support_tickets", "weight": 0.20, "description": "3 unresolved tickets"}
  -- ]
  
  -- Behavioral signals
  signals JSONB DEFAULT '{}',
  -- Example: {
  --   "failed_payments_count": 1,
  --   "days_since_last_payment": 3,
  --   "usage_trend": "declining",
  --   "support_ticket_count": 3,
  --   "login_frequency": "low",
  --   "feature_adoption": "minimal"
  -- }
  
  -- Intervention recommendations
  recommended_actions JSONB DEFAULT '[]',
  -- Example: [
  --   {"action": "payment_retry", "priority": 1, "description": "Retry failed payment"},
  --   {"action": "discount_offer", "priority": 2, "description": "Offer 20% discount for 3 months"},
  --   {"action": "personal_outreach", "priority": 3, "description": "Schedule call with customer success"}
  -- ]
  
  -- Generated outreach
  generated_email_subject TEXT,
  generated_email_body TEXT,
  email_tone TEXT DEFAULT 'professional', -- professional, friendly, urgent
  
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'resolved', 'churned')),
  actioned_at TIMESTAMPTZ,
  actioned_by UUID REFERENCES auth.users(id),
  outcome TEXT, -- saved, churned, false_positive
  outcome_notes TEXT,
  
  -- Metadata
  model_version TEXT DEFAULT 'v1.0',
  confidence_score DECIMAL(5,2), -- Model confidence in prediction
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(stripe_connection_id, customer_id, subscription_id, created_at)
);

-- Churn intervention history
CREATE TABLE IF NOT EXISTS churn_interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  churn_prediction_id UUID REFERENCES churn_predictions(id) ON DELETE CASCADE,
  stripe_connection_id UUID REFERENCES stripe_connections(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  
  -- Intervention details
  intervention_type TEXT NOT NULL, -- email, discount, call, support, custom
  intervention_description TEXT,
  email_sent BOOLEAN DEFAULT false,
  email_opened BOOLEAN DEFAULT false,
  email_clicked BOOLEAN DEFAULT false,
  
  -- Offer details (if applicable)
  offer_type TEXT, -- discount, upgrade, downgrade, pause
  offer_value TEXT, -- "20% off for 3 months", "$50 credit"
  offer_accepted BOOLEAN DEFAULT false,
  offer_accepted_at TIMESTAMPTZ,
  
  -- Outcome tracking
  customer_retained BOOLEAN,
  mrr_saved DECIMAL(10,2),
  retention_duration_days INTEGER,
  
  -- User who took action
  actioned_by UUID REFERENCES auth.users(id),
  actioned_at TIMESTAMPTZ DEFAULT NOW(),
  
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Churn model training data
CREATE TABLE IF NOT EXISTS churn_training_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_connection_id UUID REFERENCES stripe_connections(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  
  -- Features at time of observation
  features JSONB NOT NULL,
  -- Example: {
  --   "mrr": 50.00,
  --   "subscription_age_days": 180,
  --   "failed_payments_30d": 0,
  --   "usage_trend_30d": 1.2,
  --   "support_tickets_30d": 0,
  --   "plan_changes_90d": 1,
  --   "payment_method_age_days": 150
  -- }
  
  -- Outcome (label)
  churned BOOLEAN NOT NULL,
  churned_at TIMESTAMPTZ,
  days_to_churn INTEGER,
  
  -- Metadata
  observation_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Churn prevention settings
CREATE TABLE IF NOT EXISTS churn_prevention_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_connection_id UUID REFERENCES stripe_connections(id) ON DELETE CASCADE,
  
  -- Alert thresholds
  high_risk_threshold DECIMAL(5,2) DEFAULT 70.00, -- Risk score above this = high risk
  critical_risk_threshold DECIMAL(5,2) DEFAULT 85.00, -- Risk score above this = critical
  
  -- Automation settings
  auto_generate_emails BOOLEAN DEFAULT true,
  auto_send_emails BOOLEAN DEFAULT false, -- Requires explicit opt-in
  email_tone_preference TEXT DEFAULT 'professional',
  
  -- Notification preferences
  notify_on_high_risk BOOLEAN DEFAULT true,
  notify_on_critical_risk BOOLEAN DEFAULT true,
  notification_email TEXT,
  
  -- Feature flags
  ai_enabled BOOLEAN DEFAULT true,
  intervention_tracking_enabled BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(stripe_connection_id)
);

-- Indexes for performance
CREATE INDEX idx_churn_predictions_connection ON churn_predictions(stripe_connection_id);
CREATE INDEX idx_churn_predictions_risk ON churn_predictions(stripe_connection_id, risk_level, status);
CREATE INDEX idx_churn_predictions_customer ON churn_predictions(customer_id);
CREATE INDEX idx_churn_predictions_date ON churn_predictions(created_at DESC);
CREATE INDEX idx_churn_interventions_prediction ON churn_interventions(churn_prediction_id);
CREATE INDEX idx_churn_interventions_connection ON churn_interventions(stripe_connection_id);
CREATE INDEX idx_churn_training_data_connection ON churn_training_data(stripe_connection_id);

-- RLS Policies
ALTER TABLE churn_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE churn_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE churn_training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE churn_prevention_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own churn predictions" ON churn_predictions
  FOR SELECT USING (
    stripe_connection_id IN (
      SELECT id FROM stripe_connections WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users manage own churn predictions" ON churn_predictions
  FOR ALL USING (
    stripe_connection_id IN (
      SELECT id FROM stripe_connections WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users view own interventions" ON churn_interventions
  FOR SELECT USING (
    stripe_connection_id IN (
      SELECT id FROM stripe_connections WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users manage own interventions" ON churn_interventions
  FOR ALL USING (
    stripe_connection_id IN (
      SELECT id FROM stripe_connections WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users view own settings" ON churn_prevention_settings
  FOR SELECT USING (
    stripe_connection_id IN (
      SELECT id FROM stripe_connections WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users manage own settings" ON churn_prevention_settings
  FOR ALL USING (
    stripe_connection_id IN (
      SELECT id FROM stripe_connections WHERE user_id = auth.uid()
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_churn_prediction_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_churn_predictions_timestamp
  BEFORE UPDATE ON churn_predictions
  FOR EACH ROW
  EXECUTE FUNCTION update_churn_prediction_timestamp();
