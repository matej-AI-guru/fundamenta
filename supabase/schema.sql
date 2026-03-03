-- Fundamenta: ZSE Stock Screener
-- Supabase Schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- STOCKS TABLE
-- Stores scraped financial data from investiramo.com
-- ============================================================
create table if not exists public.stocks (
  ticker text primary key,
  name text not null,
  price numeric,
  market_cap numeric,          -- Tržišna kapitalizacija (EUR/HRK)
  revenue_ttm numeric,         -- Prihod TTM
  net_profit_ttm numeric,      -- Neto Dobit TTM
  eps_ttm numeric,             -- Dobit po Dionici TTM
  shares_outstanding numeric,  -- Broj Dionica u Opticaju
  pe_ratio numeric,            -- Price / Earnings
  pb_ratio numeric,            -- Price / Book
  ps_ratio numeric,            -- Price / Sales
  pcf_ratio numeric,           -- Price / Cash Flow
  pfcf_ratio numeric,          -- Price / Free Cash Flow
  -- Calculated metrics
  buffett_metric numeric,      -- Novac + Kratk. fin. imovina + EBIT × 10
  buffett_undervalue numeric,  -- Buffett metrika / Tržišna kap. - 1
  roce numeric,                -- EBIT / (Aktiva - Kratk. obveze) × 100 (%)
  net_margin numeric,          -- Net Profit / Revenue (%)
  roe numeric,                 -- Net Profit / Book Value of Equity (%)
  book_value_per_share numeric,-- Price / P/B
  revenue_per_share numeric,   -- Revenue / Shares
  earnings_yield numeric,      -- 1 / P/E (%)
  -- Meta
  currency text default 'EUR',
  last_updated timestamptz default now()
);

-- Index for fast filtering
create index if not exists idx_stocks_pe on public.stocks (pe_ratio);
create index if not exists idx_stocks_market_cap on public.stocks (market_cap);
create index if not exists idx_stocks_net_margin on public.stocks (net_margin);
create index if not exists idx_stocks_pb on public.stocks (pb_ratio);

-- RLS: public read access
alter table public.stocks enable row level security;
create policy "Public read access" on public.stocks
  for select using (true);
create policy "Service role can write" on public.stocks
  for all using (auth.role() = 'service_role');

-- ============================================================
-- SEARCH QUERIES TABLE
-- Stores every filter query for analytics
-- ============================================================
create table if not exists public.search_queries (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  filters jsonb not null,           -- Applied filter values
  results_count integer,            -- How many stocks matched
  results_tickers text[],           -- Which tickers matched
  session_id text                   -- Anonymous session identifier
);

-- Index for time-based analytics
create index if not exists idx_search_queries_created_at on public.search_queries (created_at desc);

-- RLS: only service role can read/write (no public read for privacy)
alter table public.search_queries enable row level security;
create policy "Service role only" on public.search_queries
  for all using (auth.role() = 'service_role');

-- ============================================================
-- EMAIL ALERTS TABLE
-- Stores email subscriptions for daily stock alerts
-- ============================================================
create table if not exists public.email_alerts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  filters jsonb not null default '{}',
  token text not null unique default gen_random_uuid()::text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint email_alerts_email_unique unique (email)
);

create index if not exists idx_email_alerts_active on public.email_alerts (active);

alter table public.email_alerts enable row level security;
create policy "Service role only" on public.email_alerts
  for all using (auth.role() = 'service_role');
