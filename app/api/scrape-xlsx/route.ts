import { NextRequest, NextResponse } from 'next/server';
import { scrapeXlsx } from '@/lib/xlsx-scraper';
import { supabaseAdmin } from '@/lib/supabase';
import { FINANCIAL_REPORT_URLS } from '@/lib/company_reports';

export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = req.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) return true;
  const manualSecret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret');
  return manualSecret === cronSecret;
}

// Known XLSX URLs for consolidated TFI-POD reports per ticker.
// For now, only KOEI as proof of concept.
const XLSX_URLS: Record<string, string> = {
  KOEI: 'https://koncar.hr/sites/default/files/dokumenti/financijski-izvjestaji/2026-02/Grupa_KON%C4%8CAR_TFI-POD_31%2012%202025_HR.xlsx',
};

// Shares outstanding per ticker (needed for EPS calculation).
// Fetched from mojedionice.com Sažetak page; cached here for XLSX-only runs.
const SHARES_OUTSTANDING: Record<string, number> = {
  KOEI: 2572119,
};

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ticker = req.nextUrl.searchParams.get('ticker');
  const tickers = ticker ? [ticker] : Object.keys(XLSX_URLS);

  const results: { ticker: string; years: number[]; status: string }[] = [];

  for (const t of tickers) {
    const url = XLSX_URLS[t];
    if (!url) {
      results.push({ ticker: t, years: [], status: `No XLSX URL configured` });
      continue;
    }

    try {
      const data = await scrapeXlsx(url, t, 'TFI-POD', SHARES_OUTSTANDING[t] ?? null);

      if (data.length === 0) {
        results.push({ ticker: t, years: [], status: 'No data parsed' });
        continue;
      }

      // Upsert to stock_financials
      const { error } = await supabaseAdmin
        .from('stock_financials')
        .upsert(data, { onConflict: 'ticker,year' });

      if (error) {
        console.error(`[xlsx] Upsert error for ${t}:`, error);
        results.push({ ticker: t, years: data.map(d => d.year), status: `Error: ${error.message}` });
      } else {
        results.push({ ticker: t, years: data.map(d => d.year), status: 'OK' });
      }
    } catch (err) {
      console.error(`[xlsx] Error for ${t}:`, err);
      results.push({ ticker: t, years: [], status: `Error: ${err instanceof Error ? err.message : 'Unknown'}` });
    }
  }

  return NextResponse.json({ results, timestamp: new Date().toISOString() });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
