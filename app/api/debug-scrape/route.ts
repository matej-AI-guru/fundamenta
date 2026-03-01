import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// GET /api/debug-scrape?secret=...&ticker=PODR
// Shows all /podaci?i= metrics found on a stock page + raw RSC JSON blobs
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ticker = req.nextUrl.searchParams.get('ticker') ?? 'PODR';
  const url = `https://investiramo.com/hr/dionice/${ticker}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'hr,en;q=0.9',
    },
    cache: 'no-store',
  });

  const html = await res.text();
  const $ = cheerio.load(html);

  // --- 1. Extract all /podaci?i= metric anchors and adjacent values ---
  const anchorMetrics: Record<string, string> = {};
  $('a[href*="/podaci?i="]').each((_i, el) => {
    const href = $(el).attr('href') ?? '';
    const m = href.match(/[?&]i=([a-z_]+)/);
    if (!m) return;
    const key = m[1];
    // Value is in the next sibling span
    const val =
      $(el).closest('span').next('span').text().trim() ||
      $(el).parent().next().text().trim();
    if (val) anchorMetrics[key] = val;
  });

  // --- 2. Extract JSON blobs from RSC chunks that look like financial data ---
  const rscJsonBlobs: string[] = [];
  const rscPushRe = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let m: RegExpExecArray | null;
  while ((m = rscPushRe.exec(html)) !== null) {
    try {
      const decoded = JSON.parse(`"${m[1]}"`); // unescape the JS string
      // Look for JSON blobs containing financial keys
      const financialKeys = ['EPS', 'PE_AVG', 'PS_AVG', 'PB_AVG', 'REVENUE', 'NET_PROFIT', 'PRICE', 'LAST', 'marketCap', 'netIncome'];
      if (financialKeys.some((k) => decoded.includes(k))) {
        // Extract the relevant JSON substring
        const jsonMatch = decoded.match(/\{[^{}]{50,}\}/g);
        if (jsonMatch) {
          for (const blob of jsonMatch) {
            if (financialKeys.some((k) => blob.includes(k)) && !rscJsonBlobs.includes(blob)) {
              rscJsonBlobs.push(blob.slice(0, 600));
            }
          }
        }
      }
    } catch { /* ignore */ }
  }

  // --- 3. Also check the page title for name ---
  const title = $('title').text().trim();
  const h1 = $('h1').first().text().trim();

  return NextResponse.json({
    url,
    httpStatus: res.status,
    title,
    h1,
    anchorMetrics,   // <-- these map directly to DB column names!
    rscJsonBlobs,    // <-- raw financial JSON from RSC
    htmlLength: html.length,
  });
}
