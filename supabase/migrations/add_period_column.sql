-- Add period column to distinguish annual vs quarterly data.
-- Values: 'FY' (annual), 'Q1', 'Q2', 'Q3', 'Q4'
-- Default 'FY' backfills all existing annual rows.

ALTER TABLE public.stock_financials
  ADD COLUMN IF NOT EXISTS period text NOT NULL DEFAULT 'FY';

-- Replace old unique constraint with new one that includes period
ALTER TABLE public.stock_financials
  DROP CONSTRAINT IF EXISTS stock_financials_ticker_year_unique;

ALTER TABLE public.stock_financials
  ADD CONSTRAINT stock_financials_ticker_year_period_unique
  UNIQUE (ticker, year, period);

-- Index for filtering by period
CREATE INDEX IF NOT EXISTS idx_stock_financials_period
  ON public.stock_financials (period);
