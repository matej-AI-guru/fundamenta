import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import type { FilterValues } from '@/lib/supabase';

// GET /api/stocks?filters=<json>
// Returns filtered stocks from Supabase and logs the query
export async function GET(req: NextRequest) {
  const filtersParam = req.nextUrl.searchParams.get('filters');
  let filters: Partial<FilterValues> = {};

  if (filtersParam) {
    try {
      filters = JSON.parse(filtersParam);
    } catch {
      return NextResponse.json({ error: 'Invalid filters JSON' }, { status: 400 });
    }
  }

  try {
    // Build Supabase query with filter ranges
    let query = supabase
      .from('stocks')
      .select('*')
      .order('market_cap', { ascending: false });

    // Apply numeric range filters — only if value is set
    const applyRange = (
      q: typeof query,
      col: string,
      min: number | null | undefined,
      max: number | null | undefined
    ) => {
      if (min !== null && min !== undefined) q = q.gte(col, min);
      if (max !== null && max !== undefined) q = q.lte(col, max);
      return q;
    };

    query = applyRange(query, 'pe_ratio', filters.pe_min, filters.pe_max);
    query = applyRange(query, 'market_cap', filters.market_cap_min, filters.market_cap_max);
    query = applyRange(query, 'net_margin', filters.net_margin_min, filters.net_margin_max);
    query = applyRange(query, 'pb_ratio', filters.pb_min, filters.pb_max);
    query = applyRange(query, 'revenue_ttm', filters.revenue_min, filters.revenue_max);
    query = applyRange(query, 'net_profit_ttm', filters.net_profit_min, filters.net_profit_max);
    query = applyRange(query, 'ps_ratio', filters.ps_min, filters.ps_max);
    query = applyRange(query, 'pcf_ratio', filters.pcf_min, filters.pcf_max);
    query = applyRange(query, 'pfcf_ratio', filters.pfcf_min, filters.pfcf_max);
    query = applyRange(query, 'eps_ttm', filters.eps_min, filters.eps_max);
    query = applyRange(query, 'roe', filters.roe_min, filters.roe_max);
    query = applyRange(query, 'earnings_yield', filters.earnings_yield_min, filters.earnings_yield_max);
    query = applyRange(query, 'shares_outstanding', filters.shares_min, filters.shares_max);
    query = applyRange(query, 'ev_ebitda', filters.ev_ebitda_min, filters.ev_ebitda_max);

    const { data: stocks, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log the search query asynchronously (don't await — don't block response)
    const sessionId = req.headers.get('x-session-id') ?? undefined;
    supabaseAdmin
      .from('search_queries')
      .insert({
        filters,
        results_count: stocks?.length ?? 0,
        results_tickers: stocks?.map((s) => s.ticker) ?? [],
        session_id: sessionId,
      })
      .then(({ error: logError }) => {
        if (logError) console.error('Failed to log query:', logError);
      });

    return NextResponse.json({ stocks: stocks ?? [], count: stocks?.length ?? 0 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
