import type { StockFinancials } from './supabase';

// Flow fields (income statement + cash flow) — sum last 4 quarters for TTM.
// Balance sheet fields are point-in-time — use latest quarter snapshot.
const FLOW_FIELDS = new Set([
  'revenue', 'other_operating_income', 'material_costs', 'personnel_costs',
  'depreciation', 'operating_expenses', 'operating_profit', 'financial_income',
  'financial_expenses', 'profit_before_tax', 'income_tax', 'net_profit',
  'ebit', 'ebitda',
  'operating_cash_flow', 'investing_cash_flow', 'capex', 'financing_cash_flow',
  'dividends_paid', 'free_cash_flow',
]);

// Fields to skip (metadata or computed from other TTM values)
const SKIP_FIELDS = new Set([
  'id', 'ticker', 'year', 'period', 'source', 'report_type', 'created_at',
  'net_margin', 'roe', 'roce', 'current_ratio', 'eps',
]);

/**
 * Compute TTM (Trailing Twelve Months) from 4 standalone quarterly records.
 *
 * - Flow fields (RDG + cash flow): sum all 4 quarters
 * - Balance sheet fields: use latest quarter's snapshot
 * - Derived ratios: recomputed from summed/latest values
 *
 * @param quarters - Exactly 4 consecutive standalone quarters, sorted chronologically
 * @returns A synthetic StockFinancials record with period='TTM', or null if input invalid
 */
export function computeTTM(quarters: StockFinancials[]): StockFinancials | null {
  if (quarters.length !== 4) return null;

  const latest = quarters[quarters.length - 1];
  const ttm: Record<string, unknown> = {
    id: `ttm-${latest.ticker}`,
    ticker: latest.ticker,
    year: latest.year,
    period: 'TTM',
    source: 'computed',
    report_type: latest.report_type,
    created_at: new Date().toISOString(),
  };

  // Get all numeric field names from latest quarter
  for (const key of Object.keys(latest)) {
    if (SKIP_FIELDS.has(key)) continue;

    if (FLOW_FIELDS.has(key)) {
      // Sum across all 4 quarters
      let sum: number | null = null;
      for (const q of quarters) {
        const val = (q as Record<string, unknown>)[key];
        if (typeof val === 'number') {
          sum = (sum ?? 0) + val;
        }
      }
      ttm[key] = sum;
    } else {
      // Balance sheet: use latest quarter
      ttm[key] = (latest as Record<string, unknown>)[key];
    }
  }

  // Recompute derived metrics from TTM values
  const revenue = ttm.revenue as number | null;
  const netProfit = ttm.net_profit as number | null;
  const ebit = ttm.ebit as number | null;
  const equity = ttm.equity as number | null;
  const totalAssets = ttm.total_assets as number | null;
  const currentLiab = ttm.current_liabilities as number | null;
  const currentAssets = ttm.current_assets as number | null;

  ttm.net_margin = revenue && netProfit !== null && revenue !== 0
    ? (netProfit / revenue) * 100 : null;
  ttm.roe = equity && netProfit !== null && equity !== 0
    ? (netProfit / equity) * 100 : null;
  ttm.roce = ebit !== null && totalAssets !== null && currentLiab !== null && (totalAssets - currentLiab) !== 0
    ? (ebit / (totalAssets - currentLiab)) * 100 : null;
  ttm.current_ratio = currentAssets !== null && currentLiab && currentLiab !== 0
    ? currentAssets / currentLiab : null;
  ttm.eps = null; // Will be set by caller if shares_outstanding is known

  return ttm as unknown as StockFinancials;
}

/**
 * Get the last 4 quarters from a sorted array of quarterly financials.
 * Quarters must be sorted by (year, period) ascending.
 */
export function getLast4Quarters(quarters: StockFinancials[]): StockFinancials[] {
  return quarters.slice(-4);
}
