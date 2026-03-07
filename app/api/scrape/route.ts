import { NextRequest, NextResponse } from 'next/server';
import { scrapeAllStocks, ZSE_TICKERS } from '@/lib/scraper';
import { supabaseAdmin } from '@/lib/supabase';

// Vercel Pro allows up to 300s; Hobby max is 60s
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  // Vercel cron sends: Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) return true;
  // Manual trigger support
  const manualSecret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret');
  return manualSecret === cronSecret;
}

// POST /api/scrape — scrape ZSE stocks and upsert to Supabase.
// Optional query params: ?offset=0&limit=10 (for split-cron batching)
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0');
  const limitParam = req.nextUrl.searchParams.get('limit');
  const limit = limitParam !== null ? parseInt(limitParam) : undefined;

  try {
    console.log(`Starting ZSE stock scrape (offset=${offset}, limit=${limit ?? 'all'})...`);
    const stocks = await scrapeAllStocks(
      (ticker, i, total) => { console.log(`[${i}/${total}] Scraped ${ticker}`); },
      offset,
      limit,
    );

    if (stocks.length === 0) {
      return NextResponse.json({ error: 'No stocks scraped' }, { status: 500 });
    }

    // Strip internal _yearlyData before upserting to stocks table
    const stockRows = stocks.map(({ _yearlyData: _ignored, ...rest }) => ({
      ...rest,
      last_updated: new Date().toISOString(),
    }));

    // Upsert all stocks (insert or update by ticker PK)
    const { error } = await supabaseAdmin
      .from('stocks')
      .upsert(stockRows, { onConflict: 'ticker' });

    if (error) {
      console.error('Supabase upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Upsert historical financials into stock_financials
    const historicalRows = stocks.flatMap(s => (s._yearlyData ?? []).map(d => ({ ...d, period: 'FY' })));
    if (historicalRows.length > 0) {
      const { error: histErr } = await supabaseAdmin
        .from('stock_financials')
        .upsert(historicalRows, { onConflict: 'ticker,year,period' });
      if (histErr) console.error('stock_financials upsert error:', histErr);
    }

    // Upsert daily price snapshots to price_history
    const today = new Date().toISOString().split('T')[0];
    const priceRows = stockRows
      .filter(s => s.price !== null)
      .map(s => ({ ticker: s.ticker, date: today, price: s.price! }));
    if (priceRows.length > 0) {
      const { error: phErr } = await supabaseAdmin
        .from('price_history')
        .upsert(priceRows, { onConflict: 'ticker,date' });
      if (phErr) console.error('price_history upsert error:', phErr);
    }

    // Remove any tickers from DB that are no longer on the ZSE list
    const { error: deleteError, count: deleted } = await supabaseAdmin
      .from('stocks')
      .delete({ count: 'exact' })
      .not('ticker', 'in', `(${ZSE_TICKERS.join(',')})`);

    if (deleteError) console.error('Cleanup delete error:', deleteError);

    return NextResponse.json({
      success: true,
      scraped: stocks.length,
      removed: deleted ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Scrape error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET /api/scrape — Vercel cron job calls this (GET request)
export async function GET(req: NextRequest) {
  return POST(req);
}
