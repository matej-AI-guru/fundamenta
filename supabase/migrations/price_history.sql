-- price_history: dnevni snapshoti cijena dionica
-- Punjeno svakim dnevnim scrapanjem — gradi se retroaktivno od prvog deploymenta.
-- Pokrenuti ručno u Supabase SQL Editoru.

CREATE TABLE IF NOT EXISTS public.price_history (
  id         bigserial PRIMARY KEY,
  ticker     text NOT NULL,
  date       date NOT NULL,
  price      numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT price_history_ticker_date_unique UNIQUE (ticker, date)
);

CREATE INDEX IF NOT EXISTS idx_price_history_ticker_date
  ON public.price_history (ticker, date DESC);

-- RLS
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON public.price_history
  FOR SELECT USING (true);

CREATE POLICY "Service role can write" ON public.price_history
  FOR ALL USING (auth.role() = 'service_role');
