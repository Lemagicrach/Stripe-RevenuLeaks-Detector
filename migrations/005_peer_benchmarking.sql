-- migrations/005_peer_benchmarking.sql
-- Anonymous Peer Benchmarking Network

-- Benchmark participation opt-in
CREATE TABLE IF NOT EXISTS benchmark_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_connection_id UUID REFERENCES stripe_connections(id) ON DELETE CASCADE,
  
  -- Opt-in status
  opted_in BOOLEAN DEFAULT false,
  opted_in_at TIMESTAMPTZ,
  opted_out_at TIMESTAMPTZ,
  
  -- Classification for segmentation
  industry_vertical TEXT, -- b2b_saas, b2c_saas, ecommerce, fintech, etc.
  business_model TEXT, -- subscription, usage_based, hybrid, freemium
  revenue_tier TEXT, -- under_10k, 10k_100k, 100k_500k, 500k_plus
  company_age_tier TEXT, -- under_1y, 1y_3y, 3y_5y, 5y_plus
  
  -- Anonymized identifier for data sharing
  anonymous_id UUID DEFAULT gen_random_uuid() UNIQUE,
  
  -- Data sharing preferences
  share_mrr BOOLEAN DEFAULT true,
  share_churn BOOLEAN DEFAULT true,
  share_arpu BOOLEAN DEFAULT true,
  share_growth_rate BOOLEAN DEFAULT true,
  share_ltv BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(stripe_connection_id)
);

-- Anonymized benchmark data contributions
CREATE TABLE IF NOT EXISTS benchmark_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id UUID NOT NULL, -- Links to benchmark_participants.anonymous_id
  contribution_month DATE NOT NULL,
  
  -- Classification (denormalized for performance)
  industry_vertical TEXT NOT NULL,
  business_model TEXT NOT NULL,
  revenue_tier TEXT NOT NULL,
  company_age_tier TEXT NOT NULL,
  
  -- Metrics (all anonymized and aggregated)
  mrr DECIMAL(12,2),
  arr DECIMAL(12,2),
  customer_count INTEGER,
  arpu DECIMAL(10,2),
  ltv DECIMAL(10,2),
  
  -- Growth metrics
  mrr_growth_rate DECIMAL(5,2), -- Month-over-month %
  customer_growth_rate DECIMAL(5,2),
  
  -- Churn metrics
  customer_churn_rate DECIMAL(5,2),
  revenue_churn_rate DECIMAL(5,2),
  
  -- Retention
  net_revenue_retention DECIMAL(5,2),
  
  -- Financial health
  quick_ratio DECIMAL(5,2), -- (New MRR + Expansion MRR) / (Churned MRR + Contraction MRR)
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(anonymous_id, contribution_month)
);

-- Aggregated benchmark statistics
CREATE TABLE IF NOT EXISTS benchmark_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_month DATE NOT NULL,
  
  -- Segmentation
  industry_vertical TEXT NOT NULL,
  business_model TEXT,
  revenue_tier TEXT,
  company_age_tier TEXT,
  
  -- Sample size
  participant_count INTEGER NOT NULL,
  
  -- MRR benchmarks
  mrr_median DECIMAL(12,2),
  mrr_p25 DECIMAL(12,2), -- 25th percentile
  mrr_p75 DECIMAL(12,2), -- 75th percentile
  mrr_p90 DECIMAL(12,2), -- 90th percentile
  
  -- ARPU benchmarks
  arpu_median DECIMAL(10,2),
  arpu_p25 DECIMAL(10,2),
  arpu_p75 DECIMAL(10,2),
  
  -- Growth rate benchmarks
  mrr_growth_median DECIMAL(5,2),
  mrr_growth_p25 DECIMAL(5,2),
  mrr_growth_p75 DECIMAL(5,2),
  mrr_growth_p90 DECIMAL(5,2),
  
  -- Churn rate benchmarks
  customer_churn_median DECIMAL(5,2),
  customer_churn_p25 DECIMAL(5,2),
  customer_churn_p75 DECIMAL(5,2),
  
  revenue_churn_median DECIMAL(5,2),
  revenue_churn_p25 DECIMAL(5,2),
  revenue_churn_p75 DECIMAL(5,2),
  
  -- LTV benchmarks
  ltv_median DECIMAL(10,2),
  ltv_p25 DECIMAL(10,2),
  ltv_p75 DECIMAL(10,2),
  
  -- NRR benchmarks
  nrr_median DECIMAL(5,2),
  nrr_p25 DECIMAL(5,2),
  nrr_p75 DECIMAL(5,2),
  
  -- Quick ratio benchmarks
  quick_ratio_median DECIMAL(5,2),
  quick_ratio_p25 DECIMAL(5,2),
  quick_ratio_p75 DECIMAL(5,2),
  
  -- Metadata
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(calculation_month, industry_vertical, business_model, revenue_tier, company_age_tier)
);

-- User benchmark comparisons (cached for performance)
CREATE TABLE IF NOT EXISTS user_benchmark_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_connection_id UUID REFERENCES stripe_connections(id) ON DELETE CASCADE,
  comparison_month DATE NOT NULL,
  
  -- User's actual metrics
  user_mrr DECIMAL(12,2),
  user_arpu DECIMAL(10,2),
  user_mrr_growth DECIMAL(5,2),
  user_customer_churn DECIMAL(5,2),
  user_revenue_churn DECIMAL(5,2),
  user_ltv DECIMAL(10,2),
  user_nrr DECIMAL(5,2),
  
  -- Benchmark comparison (percentile rank)
  mrr_percentile INTEGER, -- 0-100, where user ranks
  arpu_percentile INTEGER,
  mrr_growth_percentile INTEGER,
  customer_churn_percentile INTEGER, -- Lower is better
  revenue_churn_percentile INTEGER, -- Lower is better
  ltv_percentile INTEGER,
  nrr_percentile INTEGER,
  
  -- Peer group info
  peer_group_size INTEGER,
  industry_vertical TEXT,
  revenue_tier TEXT,
  
  -- Insights
  insights JSONB DEFAULT '[]',
  -- Example: [
  --   {"metric": "mrr_growth", "status": "above_average", "message": "Your MRR growth is in the top 25%"},
  --   {"metric": "churn", "status": "needs_improvement", "message": "Your churn rate is higher than 70% of peers"}
  -- ]
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(stripe_connection_id, comparison_month)
);

-- Benchmark trends (historical comparison)
CREATE TABLE IF NOT EXISTS benchmark_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trend_month DATE NOT NULL,
  
  -- Segmentation
  industry_vertical TEXT NOT NULL,
  revenue_tier TEXT,
  
  -- Trend data (month-over-month changes)
  mrr_growth_trend DECIMAL(5,2), -- Change in median MRR growth rate
  churn_trend DECIMAL(5,2), -- Change in median churn rate
  arpu_trend DECIMAL(5,2), -- Change in median ARPU
  
  -- Market insights
  market_sentiment TEXT, -- growing, stable, declining
  notable_changes TEXT[], -- Array of notable observations
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(trend_month, industry_vertical, revenue_tier)
);

-- Indexes for performance
CREATE INDEX idx_benchmark_participants_connection ON benchmark_participants(stripe_connection_id);
CREATE INDEX idx_benchmark_participants_opted_in ON benchmark_participants(opted_in) WHERE opted_in = true;
CREATE INDEX idx_benchmark_contributions_month ON benchmark_contributions(contribution_month DESC);
CREATE INDEX idx_benchmark_contributions_segment ON benchmark_contributions(industry_vertical, revenue_tier, contribution_month);
CREATE INDEX idx_benchmark_aggregates_segment ON benchmark_aggregates(industry_vertical, revenue_tier, calculation_month DESC);
CREATE INDEX idx_user_comparisons_connection ON user_benchmark_comparisons(stripe_connection_id);
CREATE INDEX idx_benchmark_trends_month ON benchmark_trends(trend_month DESC, industry_vertical);

-- RLS Policies
ALTER TABLE benchmark_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_benchmark_comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own benchmark participation" ON benchmark_participants
  FOR ALL USING (
    stripe_connection_id IN (
      SELECT id FROM stripe_connections WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users view own benchmark comparisons" ON user_benchmark_comparisons
  FOR SELECT USING (
    stripe_connection_id IN (
      SELECT id FROM stripe_connections WHERE user_id = auth.uid()
    )
  );

-- Benchmark aggregates and contributions are public (anonymized)
ALTER TABLE benchmark_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view benchmark aggregates" ON benchmark_aggregates
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view benchmark trends" ON benchmark_trends
  FOR SELECT USING (true);

-- Only system can write to contributions and aggregates
CREATE POLICY "Service role can manage contributions" ON benchmark_contributions
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role can manage aggregates" ON benchmark_aggregates
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Function to automatically classify revenue tier
CREATE OR REPLACE FUNCTION classify_revenue_tier(mrr DECIMAL)
RETURNS TEXT AS $$
BEGIN
  IF mrr < 10000 THEN
    RETURN 'under_10k';
  ELSIF mrr < 100000 THEN
    RETURN '10k_100k';
  ELSIF mrr < 500000 THEN
    RETURN '100k_500k';
  ELSE
    RETURN '500k_plus';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate percentile rank
CREATE OR REPLACE FUNCTION calculate_percentile_rank(
  user_value DECIMAL,
  all_values DECIMAL[],
  lower_is_better BOOLEAN DEFAULT false
)
RETURNS INTEGER AS $$
DECLARE
  rank INTEGER;
  total INTEGER;
BEGIN
  total := array_length(all_values, 1);
  IF total IS NULL OR total = 0 THEN
    RETURN 50; -- Default to median if no data
  END IF;
  
  IF lower_is_better THEN
    rank := (SELECT COUNT(*) FROM unnest(all_values) v WHERE v > user_value);
  ELSE
    rank := (SELECT COUNT(*) FROM unnest(all_values) v WHERE v < user_value);
  END IF;
  
  RETURN ROUND((rank::DECIMAL / total) * 100);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
