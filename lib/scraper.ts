import * as cheerio from 'cheerio';

export interface StockData {
  ticker: string;
  name: string;
  // Tržišni podaci (Sažetak)
  price: number | null;
  market_cap: number | null;
  shares_outstanding: number | null;
  // Dividende (Sažetak)
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
}

const BASE_URL = 'https://www.mojedionice.com';

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

// KOEI → KOEI-R-A, KODT2 → KODT-P-A
function sifSimFromTicker(ticker: string): string {
  if (ticker.endsWith('2')) {
    return `${ticker.slice(0, -1)}-P-A`;
  }
  return `${ticker}-R-A`;
}

// Parse Croatian number — strips thousand-separator dots, converts decimal comma.
// Returns raw number with NO extra scaling.
function parseCroatianNum(s: string | undefined): number | null {
  if (!s) return null;
  const trimmed = s.trim().replace(/\s/g, '');
  if (!trimmed || trimmed === '-' || trimmed === 'N/A') return null;
  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

// Parse Croatian float with optional M/K/B suffix — for Sažetak page values.
// "1.246,69 M" → 1,246,690,000; "760,00" → 760
function parseCroatianFloat(s: string | undefined): number | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed || trimmed === '-' || trimmed === 'N/A') return null;

  const suffixMatch = trimmed.match(/([MKB])$/i);
  const suffix = suffixMatch ? suffixMatch[1].toUpperCase() : null;
  const numStr = suffix ? trimmed.slice(0, -1).trim() : trimmed;

  // Croatian: dots = thousand separator, comma = decimal
  const normalized = numStr.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalized);
  if (isNaN(num)) return null;

  const multipliers: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9 };
  return suffix ? num * (multipliers[suffix] ?? 1) : num;
}

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'hr,en;q=0.9',
};

async function fetchWithRetry(url: string, maxRetries = 2): Promise<Response | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12_000); // 12s hard timeout per request
    try {
      const res = await fetch(url, { headers: FETCH_HEADERS, cache: 'no-store', signal: controller.signal });
      clearTimeout(t);
      if (res.ok) return res;
      if ([429, 502, 503, 504].includes(res.status)) {
        const wait = attempt * 1500;
        console.warn(`${url} → HTTP ${res.status}, retrying in ${wait / 1000}s (attempt ${attempt}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      console.warn(`Skipping ${url}: HTTP ${res.status}`);
      return null;
    } catch (e) {
      clearTimeout(t);
      if (attempt < maxRetries) {
        console.warn(`${url} → fetch error, retrying (attempt ${attempt}/${maxRetries}):`, e);
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      console.warn(`Giving up on ${url}:`, e);
      return null;
    }
  }
  console.warn(`Giving up on ${url} after ${maxRetries} retries`);
  return null;
}

// Extract value from a financial statement table by AOP number.
// Table: tr → td[0]=AOP, td[1]=label, td[2]=most recent value.
//
// scale = 1000  for Bilanca (idFinIzv=1) — values are in thousands of EUR
// scale = 1     for RDG / Novčani tok (idFinIzv=2,3 with nacPrik=24) — absolute EUR
function extractByAop(
  $: ReturnType<typeof cheerio.load>,
  aop: number,
  scale = 1000
): number | null {
  let result: number | null = null;

  $('tr').each((_i, row) => {
    const cells = $(row).find('td');
    if (cells.length < 3) return;

    const aopText = $(cells[0]).text().trim();
    if (aopText !== String(aop)) return;

    // Value is in the 3rd cell (index 2) — first data column = most recent period
    const cell = $(cells[2]);
    const span = cell.find('span[onmouseover]').first();

    let rawVal: string;
    if (span.length) {
      // Prefer the full unrounded value from the tooltip
      const onmouseover = span.attr('onmouseover') ?? '';
      const tooltipMatch = onmouseover.match(/<td[^>]*align=right[^>]*>([-\d.,]+)<\/td>/i);
      rawVal = tooltipMatch ? tooltipMatch[1] : span.text().trim();
    } else {
      rawVal = cell.text().trim();
    }

    const num = parseCroatianNum(rawVal);
    result = num !== null ? num * scale : null;
    return false; // break
  });

  return result;
}

// Fetch Sažetak page — price, market_cap, shares, dividend, dividend_yield
async function fetchSazetak(sifSim: string): Promise<{
  name: string;
  price: number | null;
  market_cap: number | null;
  shares_outstanding: number | null;
  dividend: number | null;
  dividend_yield: number | null;
}> {
  const url = `${BASE_URL}/dionica/${sifSim}`;
  const res = await fetchWithRetry(url);
  if (!res) return { name: sifSim, price: null, market_cap: null, shares_outstanding: null, dividend: null, dividend_yield: null };

  const html = await res.text();
  const $ = cheerio.load(html);

  // Company name
  const h1 = $('h1').first().text().trim();
  const name = h1.replace(/\s*:\s*Sažetak.*$/i, '').replace(new RegExp(`${sifSim}\\s*:`, 'i'), '').trim() || sifSim;

  // Price — plain float, e.g. "760,00"
  const priceRaw = $('#ctl00_ContentPlaceHolder1_labCijenaZadnja').text().trim();
  const price = parseCroatianFloat(priceRaw);

  // Market cap — shown as integer in thousands: "1.954.810" → ×1000 = 1,954,810,000
  const mcapRaw = $('#ctl00_ContentPlaceHolder1_labMCap').text().trim();
  const mcapNum = parseCroatianNum(mcapRaw);
  const market_cap = mcapNum !== null ? mcapNum * 1000 : null;

  // Shares outstanding — plain integer count, NOT in thousands: "2.572.119" → 2,572,119
  const sharesRaw = $('#ctl00_ContentPlaceHolder1_labBrDionicaRacun').text().trim();
  const shares_outstanding = parseCroatianNum(sharesRaw);

  // Dividend — scan all rows globally (div ID may not always resolve correctly)
  let dividend: number | null = null;
  let dividend_yield: number | null = null;

  $('tr').each((_i, row) => {
    if (dividend !== null && dividend_yield !== null) return false;
    const cells = $(row).find('td');
    if (cells.length < 2) return;
    const label = $(cells[0]).text().trim().toLowerCase();

    if (dividend === null && label.includes('dividenda') && !label.includes('prinos')) {
      for (const idx of [1, 2, 3]) {
        if (!cells[idx]) continue;
        const raw = $(cells[idx]).text().trim().split(/[\n\r\t]/)[0].trim();
        const val = parseCroatianFloat(raw);
        if (val !== null && val > 0) { dividend = val; break; }
      }
    }

    if (dividend_yield === null && label.includes('div') && label.includes('prinos')) {
      for (const idx of [1, 2, 3]) {
        if (!cells[idx]) continue;
        const raw = $(cells[idx]).text().trim().replace('%', '').split(/[\n\r\t]/)[0].trim();
        const val = parseCroatianFloat(raw);
        if (val !== null) { dividend_yield = val; break; }
      }
    }
  });

  // Fallback for dividend_yield via title attribute
  if (dividend_yield === null) {
    $('td[title="Dividendni prinos"]').each((_i, el) => {
      const next = $(el).next('td');
      const rawPct = next.text().trim().replace('%', '').trim();
      const val = parseCroatianFloat(rawPct);
      if (val !== null) { dividend_yield = val; return false; }
    });
  }

  return { name, price, market_cap, shares_outstanding, dividend, dividend_yield };
}

// Fetch Bilanca — balance sheet items by AOP number
// Values are in thousands of EUR → scale = 1000 (default)
async function fetchBilanca(sifSim: string): Promise<{
  total_assets: number | null;
  equity: number | null;
  current_assets: number | null;
  current_financial_assets: number | null;
  cash: number | null;
  long_term_liabilities: number | null;
  current_liabilities: number | null;
}> {
  const url = `${BASE_URL}/fund/IzvFinIzv.aspx?sifSim=${sifSim}&idFinIzv=1`;
  const res = await fetchWithRetry(url);
  if (!res) return {
    total_assets: null, equity: null, current_assets: null,
    current_financial_assets: null, cash: null,
    long_term_liabilities: null, current_liabilities: null,
  };

  const html = await res.text();
  const $ = cheerio.load(html);

  return {
    current_assets:           extractByAop($, 6),    // scale=1000 default
    current_financial_assets: extractByAop($, 9),
    cash:                     extractByAop($, 10),
    total_assets:             extractByAop($, 13),
    equity:                   extractByAop($, 50),
    long_term_liabilities:    extractByAop($, 52),
    current_liabilities:      extractByAop($, 53),
  };
}

// Fetch RDG (income statement) — revenue, ebit, depreciation, net_profit
// nacPrik=24 returns ABSOLUTE EUR values (not thousands) → scale = 1
async function fetchRDG(sifSim: string): Promise<{
  revenue: number | null;
  ebit: number | null;
  depreciation: number | null;
  net_profit: number | null;
}> {
  const url = `${BASE_URL}/fund/IzvFinIzv.aspx?sifSim=${sifSim}&idFinIzv=2&nacPrik=24&idAOPver=16`;
  const res = await fetchWithRetry(url);
  if (!res) return { revenue: null, ebit: null, depreciation: null, net_profit: null };

  const html = await res.text();
  const $ = cheerio.load(html);

  const revenue      = extractByAop($, 1,  1);
  const depreciation = extractByAop($, 17, 1);
  const net_profit   = extractByAop($, 59, 1);

  // EBIT: search by label (no fixed AOP number)
  let ebit: number | null = null;
  $('tr').each((_i, row) => {
    if (ebit !== null) return false;
    const cells = $(row).find('td');
    if (cells.length < 3) return;
    const label = $(cells[1]).text().trim().toLowerCase();
    if (label.includes('operativna dobit') || label === 'ebit') {
      const cell = $(cells[2]);
      const span = cell.find('span[onmouseover]').first();
      let rawVal: string;
      if (span.length) {
        const onmouseover = span.attr('onmouseover') ?? '';
        const tooltipMatch = onmouseover.match(/<td[^>]*align=right[^>]*>([-\d.,]+)<\/td>/i);
        rawVal = tooltipMatch ? tooltipMatch[1] : span.text().trim();
      } else {
        rawVal = cell.text().trim();
      }
      const num = parseCroatianNum(rawVal);
      ebit = num; // scale = 1 (absolute)
    }
  });

  // Fallback: EBIT = revenue - poslovni_rashodi (AOP 7)
  if (ebit === null && revenue !== null) {
    const expenses = extractByAop($, 7, 1);
    if (expenses !== null) ebit = revenue - expenses;
  }

  return { revenue, ebit, depreciation, net_profit };
}

// Fetch Novčani tok (cash flow statement)
// nacPrik=24 returns ABSOLUTE EUR values → scale = 1
async function fetchNovcanTok(sifSim: string): Promise<{
  operating_cash_flow: number | null;
  capex: number | null;
}> {
  const url = `${BASE_URL}/fund/IzvFinIzv.aspx?sifSim=${sifSim}&idFinIzv=3&nacPrik=24&idAOPver=16`;
  const res = await fetchWithRetry(url);
  if (!res) return { operating_cash_flow: null, capex: null };

  const html = await res.text();
  const $ = cheerio.load(html);

  const operating_cash_flow = extractByAop($, 20, 1);
  const capexRaw = extractByAop($, 28, 1);
  // CapEx is typically a negative cash outflow — store as positive
  const capex = capexRaw !== null ? Math.abs(capexRaw) : null;

  return { operating_cash_flow, capex };
}

export async function fetchAllTickers(): Promise<string[]> {
  return ZSE_TICKERS;
}

// Fetch and combine all data for a single ticker
export async function fetchStockData(ticker: string): Promise<StockData | null> {
  const sifSim = sifSimFromTicker(ticker);

  try {
    // Fetch 4 pages in parallel — faster than sequential
    const [sazetak, bilanca, rdg, novcanTok] = await Promise.all([
      fetchSazetak(sifSim),
      fetchBilanca(sifSim),
      fetchRDG(sifSim),
      fetchNovcanTok(sifSim),
    ]);

    const {
      name, price, market_cap, shares_outstanding, dividend, dividend_yield,
    } = sazetak;
    const {
      total_assets, equity, current_assets, current_financial_assets,
      cash, long_term_liabilities, current_liabilities,
    } = bilanca;
    const { revenue, ebit, depreciation, net_profit } = rdg;
    const { operating_cash_flow, capex } = novcanTok;

    // --- Calculated metrics ---
    const ebitda =
      ebit !== null && depreciation !== null ? ebit + depreciation : null;

    const free_cash_flow =
      operating_cash_flow !== null && capex !== null
        ? operating_cash_flow - capex
        : null;

    const current_ratio =
      current_assets !== null && current_liabilities && current_liabilities !== 0
        ? current_assets / current_liabilities
        : null;

    const net_margin =
      revenue && net_profit !== null && revenue !== 0
        ? (net_profit / revenue) * 100
        : null;

    const roe =
      equity && net_profit !== null && equity !== 0
        ? (net_profit / equity) * 100
        : null;

    const eps =
      net_profit !== null && shares_outstanding && shares_outstanding !== 0
        ? net_profit / shares_outstanding
        : null;

    const book_value_per_share =
      equity !== null && shares_outstanding && shares_outstanding !== 0
        ? equity / shares_outstanding
        : null;

    const pe_ratio =
      market_cap !== null && net_profit && net_profit !== 0
        ? market_cap / net_profit
        : null;

    const pb_ratio =
      market_cap !== null && equity && equity !== 0
        ? market_cap / equity
        : null;

    const ps_ratio =
      market_cap !== null && revenue && revenue !== 0
        ? market_cap / revenue
        : null;

    const pcf_ratio =
      market_cap !== null && operating_cash_flow && operating_cash_flow !== 0
        ? market_cap / operating_cash_flow
        : null;

    const pfcf_ratio =
      market_cap !== null && free_cash_flow && free_cash_flow !== 0
        ? market_cap / free_cash_flow
        : null;

    const earnings_yield = pe_ratio && pe_ratio !== 0 ? (1 / pe_ratio) * 100 : null;

    const revenue_per_share =
      revenue !== null && shares_outstanding && shares_outstanding !== 0
        ? revenue / shares_outstanding
        : null;

    const ev_ebitda =
      market_cap !== null && ebitda && ebitda !== 0
        ? (market_cap + (long_term_liabilities ?? 0) - (cash ?? 0)) / ebitda
        : null;

    // Skip if we got essentially nothing
    const hasData = [price, market_cap, revenue, net_profit, pe_ratio].some(
      (v) => v !== null
    );
    if (!hasData) {
      console.warn(`No usable data for ${ticker} (${sifSim})`);
      return null;
    }

    return {
      ticker,
      name,
      price,
      market_cap,
      shares_outstanding,
      dividend,
      dividend_yield,
      total_assets,
      equity,
      current_assets,
      current_financial_assets,
      cash,
      long_term_liabilities,
      current_liabilities,
      revenue,
      net_profit,
      ebit,
      depreciation,
      operating_cash_flow,
      capex,
      ebitda,
      eps,
      book_value_per_share,
      pe_ratio,
      pb_ratio,
      ps_ratio,
      pcf_ratio,
      pfcf_ratio,
      net_margin,
      roe,
      earnings_yield,
      revenue_per_share,
      free_cash_flow,
      ev_ebitda,
      current_ratio,
      currency: 'EUR',
    };
  } catch (err) {
    console.error(`Error fetching ${ticker} (${sifSim}):`, err);
    return null;
  }
}

// Scrape all stocks in concurrent batches.
//
// CONCURRENCY=3 → 3 tickers × 4 parallel pages = 12 concurrent requests.
// Trade-off vs CONCURRENCY=5 (20 req) which caused rate-limiting on mojedionice.com.
//
// Timeline: 16 batches × ~1.8s ≈ 29s — fits within Vercel Hobby 30s hard limit.
// On Pro plan (maxDuration=300) this completes well within budget regardless.
export async function scrapeAllStocks(
  onProgress?: (ticker: string, index: number, total: number) => void
): Promise<StockData[]> {
  const tickers = await fetchAllTickers();
  console.log(`Scraping ${tickers.length} ZSE tickers from mojedionice.com`);

  const CONCURRENCY = 3;
  const results: StockData[] = [];

  for (let i = 0; i < tickers.length; i += CONCURRENCY) {
    const batch = tickers.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (ticker, j) => {
        onProgress?.(ticker, i + j + 1, tickers.length);
        return fetchStockData(ticker);
      })
    );
    results.push(...(batchResults.filter(Boolean) as StockData[]));

    if (i + CONCURRENCY < tickers.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return results;
}
