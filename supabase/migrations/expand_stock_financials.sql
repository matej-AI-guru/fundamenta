-- Proširenje stock_financials tablice s detaljnijim financijskim stavkama
-- iz XLSX TFI-POD/GFI-POD izvještaja.
-- Pokrenuti ručno u Supabase SQL Editoru.

-- Bilanca - novi stupci
ALTER TABLE public.stock_financials ADD COLUMN IF NOT EXISTS non_current_assets numeric;
ALTER TABLE public.stock_financials ADD COLUMN IF NOT EXISTS intangible_assets numeric;
ALTER TABLE public.stock_financials ADD COLUMN IF NOT EXISTS tangible_assets numeric;
ALTER TABLE public.stock_financials ADD COLUMN IF NOT EXISTS inventories numeric;
ALTER TABLE public.stock_financials ADD COLUMN IF NOT EXISTS receivables numeric;
ALTER TABLE public.stock_financials ADD COLUMN IF NOT EXISTS share_capital numeric;
ALTER TABLE public.stock_financials ADD COLUMN IF NOT EXISTS retained_earnings numeric;
ALTER TABLE public.stock_financials ADD COLUMN IF NOT EXISTS provisions numeric;

-- RDG - novi stupci
ALTER TABLE public.stock_financials ADD COLUMN IF NOT EXISTS other_operating_income numeric;
ALTER TABLE public.stock_financials ADD COLUMN IF NOT EXISTS material_costs numeric;
ALTER TABLE public.stock_financials ADD COLUMN IF NOT EXISTS personnel_costs numeric;
ALTER TABLE public.stock_financials ADD COLUMN IF NOT EXISTS operating_expenses numeric;
ALTER TABLE public.stock_financials ADD COLUMN IF NOT EXISTS operating_profit numeric;
ALTER TABLE public.stock_financials ADD COLUMN IF NOT EXISTS financial_income numeric;
ALTER TABLE public.stock_financials ADD COLUMN IF NOT EXISTS financial_expenses numeric;
ALTER TABLE public.stock_financials ADD COLUMN IF NOT EXISTS profit_before_tax numeric;
ALTER TABLE public.stock_financials ADD COLUMN IF NOT EXISTS income_tax numeric;

-- Novčani tok - novi stupci
ALTER TABLE public.stock_financials ADD COLUMN IF NOT EXISTS investing_cash_flow numeric;
ALTER TABLE public.stock_financials ADD COLUMN IF NOT EXISTS financing_cash_flow numeric;
ALTER TABLE public.stock_financials ADD COLUMN IF NOT EXISTS dividends_paid numeric;

-- Metapodaci o izvoru podataka
ALTER TABLE public.stock_financials ADD COLUMN IF NOT EXISTS source text DEFAULT 'mojedionice';
ALTER TABLE public.stock_financials ADD COLUMN IF NOT EXISTS report_type text;
