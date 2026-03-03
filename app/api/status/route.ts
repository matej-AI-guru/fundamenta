import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ZSE_TICKERS } from '@/lib/scraper';

// GET /api/status — check today's scrape coverage
// Returns which tickers were updated today and which are missing.
export async function GET() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabaseAdmin
    .from('stocks')
    .select('ticker, last_updated');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const updatedToday = (data ?? []).filter(
    (s) => new Date(s.last_updated) >= todayStart
  );
  const foundSet = new Set(updatedToday.map((s) => s.ticker));
  const missing = ZSE_TICKERS.filter((t) => !foundSet.has(t));
  const ok = missing.length === 0;

  if (!ok) {
    console.warn(
      `Scrape coverage: ${updatedToday.length}/${ZSE_TICKERS.length} — nedostaje: ${missing.join(', ')}`
    );
  } else {
    console.log(`Scrape coverage: ${updatedToday.length}/${ZSE_TICKERS.length} — sve OK`);
  }

  return NextResponse.json(
    {
      ok,
      expected: ZSE_TICKERS.length,
      updated_today: updatedToday.length,
      missing,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 206 }
  );
}
