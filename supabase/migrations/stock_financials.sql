-- stock_financials: godišnji financijski podaci po dionici (višegodišnja historija)
-- Pokrenuti ručno u Supabase SQL Editoru

CREATE TABLE IF NOT EXISTS public.stock_financials (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker                   text NOT NULL,
  year                     integer NOT NULL,
  -- RDG (Račun dobiti i gubitka)
  revenue                  numeric,
  ebit                     numeric,
  depreciation             numeric,
  net_profit               numeric,
  ebitda                   numeric,
  -- Bilanca
  total_assets             numeric,
  equity                   numeric,
  current_assets           numeric,
  current_financial_assets numeric,
  cash                     numeric,
  long_term_liabilities    numeric,
  current_liabilities      numeric,
  -- Novčani tok
  operating_cash_flow      numeric,
  capex                    numeric,
  free_cash_flow           numeric,
  -- Izračunato (pohranjeno za brz pristup)
  net_margin               numeric,
  roe                      numeric,
  roce                     numeric,
  current_ratio            numeric,
  eps                      numeric,
  created_at               timestamptz DEFAULT now(),
  CONSTRAINT stock_financials_ticker_year_unique UNIQUE (ticker, year)
);

CREATE INDEX IF NOT EXISTS idx_stock_financials_ticker
  ON public.stock_financials (ticker);

CREATE INDEX IF NOT EXISTS idx_stock_financials_year
  ON public.stock_financials (year);

-- RLS
ALTER TABLE public.stock_financials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON public.stock_financials
  FOR SELECT USING (true);

CREATE POLICY "Service role can write" ON public.stock_financials
  FOR ALL USING (auth.role() = 'service_role');
