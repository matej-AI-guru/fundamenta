import { NextRequest, NextResponse } from 'next/server';
import { scrapeAllStocks, ZSE_TICKERS } from '@/lib/scraper';
import { supabaseAdmin } from '@/lib/supabase';

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

// POST /api/scrape — scrape all ZSE stocks and upsert to Supabase
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('Starting ZSE stock scrape...');
    const stocks = await scrapeAllStocks((ticker, i, total) => {
      console.log(`[${i}/${total}] Scraped ${ticker}`);
    });

    if (stocks.length === 0) {
      return NextResponse.json({ error: 'No stocks scraped' }, { status: 500 });
    }

    // Upsert all stocks (insert or update by ticker PK)
    const { error } = await supabaseAdmin
      .from('stocks')
      .upsert(
        stocks.map((s) => ({ ...s, last_updated: new Date().toISOString() })),
        { onConflict: 'ticker' }
      );

    if (error) {
      console.error('Supabase upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
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
