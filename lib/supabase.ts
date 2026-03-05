import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy singletons — avoids build-time errors when env vars are not set
let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _supabase;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _supabaseAdmin;
}

// Proxy objects so existing import syntax still works without eager init
export const supabase = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    return (getSupabase() as unknown as Record<string, unknown>)[prop as string];
  },
});

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    return (getSupabaseAdmin() as unknown as Record<string, unknown>)[prop as string];
  },
});

export type Stock = {
  ticker: string;
  name: string;
  // Tržišni podaci
  price: number | null;
  market_cap: number | null;
  shares_outstanding: number | null;
  // Dividende
  dividend: number | null;
  dividend_yield: number | null;
  // Bilanca
  total_assets: number | null;
  equity: number | null;
  current_assets: number | null;
  current_financial_assets: number | null;
  cash: number | null;
  long_term_liabilities: number | null;
  current_liabilities: number | null;
  // RDG
  revenue: number | null;
  net_profit: number | null;
  ebit: number | null;
  depreciation: number | null;
  // Novčani tok
  operating_cash_flow: number | null;
  capex: number | null;
  // Izračunato
  ebitda: number | null;
  buffett_metric: number | null;
  buffett_undervalue: number | null;
  roce: number | null;
  eps: number | null;
  book_value_per_share: number | null;
  pe_ratio: number | null;
  pb_ratio: number | null;
  ps_ratio: number | null;
  pcf_ratio: number | null;
  pfcf_ratio: number | null;
  net_margin: number | null;
  roe: number | null;
  earnings_yield: number | null;
  revenue_per_share: number | null;
  free_cash_flow: number | null;
  ev_ebitda: number | null;
  current_ratio: number | null;
  currency: string;
  last_updated: string;
};

export type StockFinancials = {
  id: string;
  ticker: string;
  year: number;
  revenue: number | null;
  ebit: number | null;
  depreciation: number | null;
  net_profit: number | null;
  ebitda: number | null;
  total_assets: number | null;
  equity: number | null;
  current_assets: number | null;
  current_financial_assets: number | null;
  cash: number | null;
  long_term_liabilities: number | null;
  current_liabilities: number | null;
  operating_cash_flow: number | null;
  capex: number | null;
  free_cash_flow: number | null;
  net_margin: number | null;
  roe: number | null;
  roce: number | null;
  current_ratio: number | null;
  eps: number | null;
  created_at: string;
};

export type EmailAlert = {
  id: string;
  email: string;
  filters: Partial<FilterValues>;
  token: string;
  active: boolean;
  created_at: string;
};

export type FilterValues = {
  pe_min: number | null;
  pe_max: number | null;
  market_cap_min: number | null;
  market_cap_max: number | null;
  net_margin_min: number | null;
  net_margin_max: number | null;
  pb_min: number | null;
  pb_max: number | null;
  revenue_min: number | null;
  revenue_max: number | null;
  net_profit_min: number | null;
  net_profit_max: number | null;
  // Additional filters
  ps_min: number | null;
  ps_max: number | null;
  pcf_min: number | null;
  pcf_max: number | null;
  pfcf_min: number | null;
  pfcf_max: number | null;
  eps_min: number | null;
  eps_max: number | null;
  roe_min: number | null;
  roe_max: number | null;
  earnings_yield_min: number | null;
  earnings_yield_max: number | null;
  ev_ebitda_min: number | null;
  ev_ebitda_max: number | null;
  ebit_min: number | null;
  ebit_max: number | null;
  current_ratio_min: number | null;
  current_ratio_max: number | null;
  dividend_yield_min: number | null;
  dividend_yield_max: number | null;
  free_cash_flow_min: number | null;
  free_cash_flow_max: number | null;
  buffett_undervalue_min: number | null;
  buffett_undervalue_max: number | null;
  roce_min: number | null;
  roce_max: number | null;
};
