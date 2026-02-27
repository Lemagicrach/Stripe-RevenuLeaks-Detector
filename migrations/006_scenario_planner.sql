-- migrations/006_scenario_planner.sql
-- Revenue Scenario Planner with What-If Modeling

-- Saved scenarios
CREATE TABLE IF NOT EXISTS revenue_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_connection_id UUID REFERENCES stripe_connections(id) ON DELETE CASCADE,
  
  -- Scenario metadata
  name TEXT NOT NULL,
  description TEXT,
  scenario_type TEXT NOT NULL, -- custom, churn_reduction, price_increase, growth_acceleration
  
  -- Base metrics (current state)
  base_mrr DECIMAL(12,2) NOT NULL,
  base_customer_count INTEGER NOT NULL,
  base_churn_rate DECIMAL(5,2) NOT NULL,
  base_arpu DECIMAL(10,2) NOT NULL,
  
  -- Scenario parameters
  parameters JSONB NOT NULL,
  -- Example for churn_reduction:
  -- {
  --   "churn_rate_reduction": 2.0,  // Reduce churn by 2%
  --   "timeframe_months": 12
  -- }
  -- Example for price_increase:
  -- {
  --   "price_increase_percent": 20,
  --   "customer_loss_percent": 5,  // Expected churn from price increase
  --   "timeframe_months": 12
  -- }
  -- Example for growth_acceleration:
  -- {
  --   "new_customers_per_month": 10,
  --   "timeframe_months": 12
  -- }
  
  -- Projected results
  projected_metrics JSONB NOT NULL,
  -- {
  --   "month_1": {"mrr": 50000, "customers": 100, "arr": 600000},
  --   "month_3": {"mrr": 52000, "customers": 104, "arr": 624000},
  --   "month_6": {"mrr": 55000, "customers": 110, "arr": 660000},
  --   "month_12": {"mrr": 60000, "customers": 120, "arr": 720000}
  -- }
  
  -- Impact summary
  mrr_impact_12m DECIMAL(12,2), -- MRR difference at 12 months
  arr_impact_12m DECIMAL(12,2), -- ARR difference at 12 months
  customer_impact_12m INTEGER, -- Customer count difference
  revenue_impact_total DECIMAL(12,2), -- Total additional revenue over period
  
  -- Comparison insights
  insights JSONB DEFAULT '[]',
  -- [
  --   {"message": "Reducing churn by 2% would add $10,000 MRR in 12 months"},
  --   {"message": "This is equivalent to acquiring 20 new customers"},
  --   {"message": "ROI: Every 1% churn reduction = $5,000 MRR"}
  -- ]
  
  -- Status
  is_favorite BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scenario comparisons (compare multiple scenarios side-by-side)
CREATE TABLE IF NOT EXISTS scenario_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_connection_id UUID REFERENCES stripe_connections(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  scenario_ids UUID[] NOT NULL, -- Array of scenario IDs to compare
  
  -- Comparison insights
  best_scenario_id UUID, -- Which scenario performs best
  comparison_insights JSONB DEFAULT '[]',
  -- [
  --   {"metric": "mrr_12m", "winner": "scenario_1", "difference": 5000},
  --   {"insight": "Churn reduction has 2x impact of price increase"}
  -- ]
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scenario templates (pre-built scenarios for common use cases)
CREATE TABLE IF NOT EXISTS scenario_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- growth, retention, pricing, efficiency
  
  -- Template parameters with defaults
  parameters_template JSONB NOT NULL,
  -- {
  --   "churn_rate_reduction": {"default": 2.0, "min": 0.5, "max": 10.0, "step": 0.5},
  --   "timeframe_months": {"default": 12, "options": [3, 6, 12, 24]}
  -- }
  
  -- Calculation formula (for reference)
  calculation_notes TEXT,
  
  -- Popularity
  usage_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default templates
INSERT INTO scenario_templates (name, description, category, parameters_template, calculation_notes) VALUES
(
  'Reduce Churn Rate',
  'See the impact of reducing customer churn on your revenue',
  'retention',
  '{
    "churn_rate_reduction": {"default": 2.0, "min": 0.5, "max": 10.0, "step": 0.5, "label": "Reduce churn by (%)"},
    "timeframe_months": {"default": 12, "options": [3, 6, 12, 24], "label": "Timeframe"}
  }',
  'Compounds monthly: retained_customers = base * (1 - (churn_rate - reduction)/100)^months'
),
(
  'Increase Prices',
  'Model the impact of a price increase on revenue and churn',
  'pricing',
  '{
    "price_increase_percent": {"default": 20, "min": 5, "max": 100, "step": 5, "label": "Price increase (%)"},
    "expected_churn_percent": {"default": 5, "min": 0, "max": 50, "step": 5, "label": "Expected customer loss (%)"},
    "timeframe_months": {"default": 12, "options": [3, 6, 12, 24], "label": "Timeframe"}
  }',
  'Immediate impact on ARPU, one-time churn event, then normal growth resumes'
),
(
  'Accelerate Growth',
  'Project revenue with increased customer acquisition',
  'growth',
  '{
    "new_customers_per_month": {"default": 10, "min": 1, "max": 100, "step": 1, "label": "New customers/month"},
    "avg_customer_value": {"default": null, "min": 10, "max": 10000, "step": 10, "label": "Avg customer MRR ($)", "use_current": true},
    "timeframe_months": {"default": 12, "options": [3, 6, 12, 24], "label": "Timeframe"}
  }',
  'Linear growth: new_mrr = new_customers * avg_value * months, accounting for churn'
),
(
  'Improve Retention',
  'Compare impact of retention improvements vs new customer acquisition',
  'retention',
  '{
    "retention_improvement_percent": {"default": 10, "min": 5, "max": 50, "step": 5, "label": "Retention improvement (%)"},
    "timeframe_months": {"default": 12, "options": [3, 6, 12, 24], "label": "Timeframe"}
  }',
  'Reduces effective churn rate, compounds over time'
),
(
  'Upsell Existing Customers',
  'Model revenue from upselling current customer base',
  'growth',
  '{
    "customers_to_upsell_percent": {"default": 20, "min": 5, "max": 100, "step": 5, "label": "% of customers to upsell"},
    "upsell_value_increase_percent": {"default": 50, "min": 10, "max": 200, "step": 10, "label": "Avg upsell value increase (%)"},
    "timeframe_months": {"default": 12, "options": [3, 6, 12, 24], "label": "Timeframe"}
  }',
  'Expansion MRR from existing customers'
);

-- Indexes
CREATE INDEX idx_revenue_scenarios_connection ON revenue_scenarios(stripe_connection_id);
CREATE INDEX idx_revenue_scenarios_type ON revenue_scenarios(scenario_type);
CREATE INDEX idx_revenue_scenarios_favorite ON revenue_scenarios(is_favorite) WHERE is_favorite = true;
CREATE INDEX idx_scenario_comparisons_connection ON scenario_comparisons(stripe_connection_id);
CREATE INDEX idx_scenario_templates_category ON scenario_templates(category);

-- RLS Policies
ALTER TABLE revenue_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own scenarios" ON revenue_scenarios
  FOR ALL USING (
    stripe_connection_id IN (
      SELECT id FROM stripe_connections WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users manage own comparisons" ON scenario_comparisons
  FOR ALL USING (
    stripe_connection_id IN (
      SELECT id FROM stripe_connections WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view templates" ON scenario_templates
  FOR SELECT USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_scenario_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_revenue_scenarios_timestamp
  BEFORE UPDATE ON revenue_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION update_scenario_timestamp();
