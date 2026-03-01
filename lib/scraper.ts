import * as cheerio from 'cheerio';

export interface StockData {
  ticker: string;
  name: string;
  price: number | null;
  market_cap: number | null;
  revenue_ttm: number | null;
  net_profit_ttm: number | null;
  eps_ttm: number | null;
  shares_outstanding: number | null;
  pe_ratio: number | null;
  pb_ratio: number | null;
  ps_ratio: number | null;
  pcf_ratio: number | null;
  pfcf_ratio: number | null;
  net_margin: number | null;
  roe: number | null;
  book_value_per_share: number | null;
  revenue_per_share: number | null;
  earnings_yield: number | null;
  ebitda_ttm: number | null;
  ev_ebitda: number | null;
  cash_and_equivalents: number | null;
  currency: string;
}

const BASE_URL = 'https://investiramo.com';

// ZSE tickers — full list as of 2026-03-01
export const ZSE_TICKERS = [
  'ACI', 'ADPL', 'ADRS', 'ADRS2', 'ARNT', 'ATGR', 'AUHR',
  'BRIN', 'BSQR',
  'CKML', 'CROS', 'CROS2', 'CTKS',
  'DDJH', 'DLKV',
  'ERNT',
  'GRNL',
  'HEFA', 'HPB', 'HPDG', 'HT',
  'IG', 'IGH', 'IKBA', 'INA', 'INGR',
  'JDGT', 'JDOS', 'JDPL',
  'KODT', 'KODT2', 'KOEI', 'KRAS',
  'LKPC', 'LKRI',
  'MDKA', 'MONP',
  'PLAG', 'PODR',
  'RIVP',
  'SNBA', 'SPAN',
  'TKPR', 'TOK',
  'ULPL',
  'VLEN',
  'ZABA', 'ZITO',
];

// Parse number like "1,107.85M" or "7.03M" or "19.26" → actual number
function parseMetricValue(raw: string | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s || s === '-' || s === 'N/A' || s === 'Prijavi se') return null;

  // Detect suffix (K, M, B, T)
  const suffixMatch = s.match(/([KMBT])$/i);
  const suffix = suffixMatch ? suffixMatch[1].toUpperCase() : null;
  const numStr = suffix ? s.slice(0, -1) : s;

  // Investiramo uses English format: comma as thousand separator, dot as decimal
  // e.g. "1,107.85" → 1107.85, "7.03" → 7.03
  const normalized = numStr.replace(/,/g, '');
  const num = parseFloat(normalized);
  if (isNaN(num)) return null;

  const multipliers: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
  return suffix ? num * (multipliers[suffix] ?? 1) : num;
}

// Returns the list of tickers to scrape
export async function fetchAllTickers(): Promise<string[]> {
  return ZSE_TICKERS;
}

// Decode all self.__next_f.push([1,"..."]) RSC chunks from a page into plain text
function decodeRscChunks(html: string): string {
  const parts: string[] = [];
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try { parts.push(JSON.parse(`"${m[1]}"`)); } catch { /* skip */ }
  }
  return parts.join('\n');
}

// Extract the most recent closing price from RSC JSON embedded in the page
// RSC chunks use escaped JSON: \"LAST\":149.5 in raw HTML, but plain after decoding
function extractLatestPrice(html: string): number | null {
  const rsc = decodeRscChunks(html);
  const text = rsc || html;
  // After decoding, the format is plain JSON: "LAST":149.5
  const m = text.match(/"LAST"\s*:\s*([\d.]+)/);
  if (m) {
    const price = parseFloat(m[1]);
    return isNaN(price) ? null : price;
  }
  return null;
}

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'hr,en;q=0.9',
};

// Fetch with automatic retry on 502/503/429 (rate limit / server overload)
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, { headers: FETCH_HEADERS, cache: 'no-store' });
    if (res.ok) return res;
    // Retryable server errors
    if ([429, 502, 503, 504].includes(res.status)) {
      const wait = attempt * 3000; // 3s, 6s, 9s
      console.warn(`${url} → HTTP ${res.status}, retrying in ${wait / 1000}s (attempt ${attempt}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    // Non-retryable (404, etc.)
    console.warn(`Skipping ${url}: HTTP ${res.status}`);
    return null;
  }
  console.warn(`Giving up on ${url} after ${maxRetries} retries`);
  return null;
}

// Fetch current prices for all tickers from the listing page in one request
async function fetchListingPrices(): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  try {
    const res = await fetchWithRetry(`${BASE_URL}/hr/dionice`);
    if (!res) return prices;

    const html = await res.text();
    const rsc = decodeRscChunks(html);

    // Strategy 1: structured ticker+price fields in RSC JSON
    // e.g. "ticker":"PODR"..."price":149.5 or "symbol":"PODR"..."last":149.5
    const structuredRe = /"(?:ticker|symbol|code)"\s*:\s*"([A-Z]{2,6}[0-9]?)"[^}]{1,600}?"(?:price|last|lastPrice|cijena)"\s*:\s*([\d.]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = structuredRe.exec(rsc)) !== null) {
      const ticker = m[1].toUpperCase();
      if (ZSE_TICKERS.includes(ticker) && !prices.has(ticker)) {
        prices.set(ticker, parseFloat(m[2]));
      }
    }

    console.log(`Listing page prices found: ${prices.size}/${ZSE_TICKERS.length} (remaining will use individual page RSC)`);
  } catch (err) {
    console.warn('fetchListingPrices failed:', err);
  }
  return prices;
}

// Fetch financial data for a single stock ticker
export async function fetchStockData(
  ticker: string,
  listingPrice?: number
): Promise<StockData | null> {
  const url = `${BASE_URL}/hr/dionice/${ticker}`;

  try {
    const res = await fetchWithRetry(url);
    if (!res) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    // Company name from h1: "Podravka d.d. (PODR)"
    const h1 = $('h1').first().text().trim();
    const name = h1.replace(/\s*\([^)]+\)\s*$/, '').trim() || ticker;

    // --- Extract all /podaci?i=METRIC_NAME anchor metrics ---
    const raw: Record<string, string> = {};

    function extractRaw(doc: ReturnType<typeof cheerio.load>, target: Record<string, string>, overwrite = false) {
      doc('a[href*="/podaci?i="]').each((_i, el) => {
        const href = doc(el).attr('href') ?? '';
        const m = href.match(/[?&]i=([a-z_]+)/);
        if (!m) return;
        const key = m[1];
        if (!overwrite && target[key]) return;
        const val =
          doc(el).closest('span').next('span').text().trim() ||
          doc(el).parent().next().text().trim() ||
          doc(el).closest('td').next('td').text().trim() ||
          doc(el).next('span').text().trim() ||
          doc(el).parent().clone().children().remove().end().text().trim();
        if (val && val !== 'Prijavi se') target[key] = val;
      });
    }

    extractRaw($, raw, true);

    // Also fetch kljucni-pokazatelji — cash is only available there
    try {
      const kpRes = await fetchWithRetry(`${BASE_URL}/hr/dionice/${ticker}/kljucni-pokazatelji`);
      if (kpRes) {
        const kpHtml = await kpRes.text();
        const $kp = cheerio.load(kpHtml);
        extractRaw($kp, raw, false); // don't overwrite main-page values
      }
    } catch { /* ignore */ }

    // --- Parse the metrics we care about ---
    // investiramo.com uses "net_income_ttm" for what we store as net_profit_ttm
    const revenue_ttm = parseMetricValue(raw['revenue_ttm']);
    const net_profit_ttm = parseMetricValue(raw['net_income_ttm']);
    const eps_ttm = parseMetricValue(raw['eps_ttm']);
    const market_cap = parseMetricValue(raw['market_cap']);
    const pe_ratio = parseMetricValue(raw['pe_ratio']);
    const pb_ratio = parseMetricValue(raw['pb_ratio']);
    const ps_ratio = parseMetricValue(raw['ps_ratio']);
    const pcf_ratio = parseMetricValue(raw['pcf_ratio']);
    const pfcf_ratio = parseMetricValue(raw['pfcf_ratio']);
    const shares_outstanding = parseMetricValue(raw['shares_outstanding']);
    const shareholders_equity = parseMetricValue(raw['shareholders_equity_quarterly']);
    const ebitda_ttm = parseMetricValue(raw['ebitda_ttm']);
    const total_debt = parseMetricValue(raw['total_debt_quarterly']);
    const cash_and_equivalents = parseMetricValue(raw['cash_and_equivalents_quarterly']);

    // Price: listing page (real-time) → individual page RSC → null
    const price = listingPrice ?? extractLatestPrice(html);

    // --- Calculated metrics ---
    const net_margin =
      revenue_ttm && net_profit_ttm && revenue_ttm !== 0
        ? (net_profit_ttm / revenue_ttm) * 100
        : null;

    // ROE = Net Income / Shareholders' Equity  (use quarterly equity as approximation)
    const roe =
      net_profit_ttm && shareholders_equity && shareholders_equity !== 0
        ? (net_profit_ttm / shareholders_equity) * 100
        : null;

    // Book value per share = Equity / Shares Outstanding
    const book_value_per_share =
      shareholders_equity && shares_outstanding && shares_outstanding !== 0
        ? shareholders_equity / shares_outstanding
        : price && pb_ratio && pb_ratio !== 0
        ? price / pb_ratio
        : null;

    const revenue_per_share =
      revenue_ttm && shares_outstanding && shares_outstanding !== 0
        ? revenue_ttm / shares_outstanding
        : null;

    const earnings_yield = pe_ratio && pe_ratio !== 0 ? (1 / pe_ratio) * 100 : null;

    // EV/EBITDA = (Market Cap + Total Debt - Cash) / EBITDA TTM
    const ev_ebitda =
      market_cap !== null && total_debt !== null && ebitda_ttm && ebitda_ttm !== 0
        ? (market_cap + total_debt - (cash_and_equivalents ?? 0)) / ebitda_ttm
        : null;

    // Skip if we got essentially nothing useful
    const hasData = [pe_ratio, pb_ratio, market_cap, revenue_ttm, net_profit_ttm, price].some(
      (v) => v !== null
    );
    if (!hasData) {
      console.warn(`No usable data for ${ticker} — ticker may not exist on investiramo.com`);
      return null;
    }

    return {
      ticker,
      name,
      price,
      market_cap,
      revenue_ttm,
      net_profit_ttm,
      eps_ttm,
      shares_outstanding,
      pe_ratio,
      pb_ratio,
      ps_ratio,
      pcf_ratio,
      pfcf_ratio,
      net_margin,
      roe,
      book_value_per_share,
      revenue_per_share,
      earnings_yield,
      ebitda_ttm,
      ev_ebitda,
      cash_and_equivalents,
      currency: 'EUR',
    };
  } catch (err) {
    console.error(`Error fetching ${ticker}:`, err);
    return null;
  }
}

// Scrape all stocks with a polite delay between requests
export async function scrapeAllStocks(
  onProgress?: (ticker: string, index: number, total: number) => void
): Promise<StockData[]> {
  const tickers = await fetchAllTickers();
  console.log(`Scraping ${tickers.length} ZSE tickers`);

  // Pre-fetch all current prices from the listing page (one request instead of 48)
  const listingPrices = await fetchListingPrices();

  const results: StockData[] = [];

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    onProgress?.(ticker, i + 1, tickers.length);

    const data = await fetchStockData(ticker, listingPrices.get(ticker));
    if (data) results.push(data);

    if (i < tickers.length - 1) {
      await new Promise((r) => setTimeout(r, 700));
    }
  }

  return results;
}
