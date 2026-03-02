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

// Parse Croatian float format: "1.246,69 M" → 1,246,690,000
// Used for Sažetak page values (with M/K/B suffix)
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

// Parse Croatian integer format from financial statements: "1.169.446" → 1,169,446,000
// Values in financial statements are in thousands of EUR → ×1000
function parseCroatianInt(s: string | undefined): number | null {
  if (!s) return null;
  const trimmed = s.trim().replace(/\s/g, '');
  if (!trimmed || trimmed === '-' || trimmed === 'N/A') return null;

  // Remove dots (thousand separators), replace comma with dot
  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalized);
  if (isNaN(num)) return null;

  // Financial statements are in thousands of EUR
  return num * 1000;
}

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'hr,en;q=0.9',
};

async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, { headers: FETCH_HEADERS, cache: 'no-store' });
    if (res.ok) return res;
    if ([429, 502, 503, 504].includes(res.status)) {
      const wait = attempt * 3000;
      console.warn(`${url} → HTTP ${res.status}, retrying in ${wait / 1000}s (attempt ${attempt}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    console.warn(`Skipping ${url}: HTTP ${res.status}`);
    return null;
  }
  console.warn(`Giving up on ${url} after ${maxRetries} retries`);
  return null;
}

// Extract value from financial statement table by AOP number
// Table structure: tr → td[0]=AOP, td[1]=label, td[2]=most recent value
function extractByAop(
  $: ReturnType<typeof cheerio.load>,
  aop: number
): number | null {
  let result: number | null = null;

  $('tr').each((_i, row) => {
    const cells = $(row).find('td');
    if (cells.length < 3) return;

    const aopText = $(cells[0]).text().trim();
    if (aopText !== String(aop)) return;

    // Value is in the 3rd cell (index 2) — first data column = most recent period
    // The value might be in a span with onmouseover or as plain text
    const cell = $(cells[2]);
    const span = cell.find('span[onmouseover]').first();

    let rawVal: string;
    if (span.length) {
      // Try to get the full unrounded value from the tooltip
      const onmouseover = span.attr('onmouseover') ?? '';
      const tooltipMatch = onmouseover.match(/<td[^>]*align=right[^>]*>([-\d.,]+)<\/td>/i);
      if (tooltipMatch) {
        rawVal = tooltipMatch[1];
      } else {
        rawVal = span.text().trim();
      }
    } else {
      rawVal = cell.text().trim();
    }

    result = parseCroatianInt(rawVal);
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

  // Company name from page title or h1
  const h1 = $('h1').first().text().trim();
  const name = h1.replace(/\s*:\s*Sažetak.*$/i, '').replace(/KOEI-R-A\s*:/i, '').trim() || sifSim;

  // Price
  const priceRaw = $('#ctl00_ContentPlaceHolder1_labCijenaZadnja').text().trim();
  const price = parseCroatianFloat(priceRaw);

  // Market cap (in thousands → ×1000 already handled by multiplying the integer)
  const mcapRaw = $('#ctl00_ContentPlaceHolder1_labMCap').text().trim();
  // Market cap is shown as integer in thousands: "1.954.810" → 1,954,810,000
  const market_cap = parseCroatianInt(mcapRaw);

  // Shares outstanding
  const sharesRaw = $('#ctl00_ContentPlaceHolder1_labBrDionicaRacun').text().trim();
  const shares_outstanding = parseCroatianInt(sharesRaw);

  // Dividend — from dividend table
  let dividend: number | null = null;
  let dividend_yield: number | null = null;

  const divDiv = $('#ctl00_ContentPlaceHolder1_naslovDivid');
  if (divDiv.length) {
    // Find "Dividenda" row
    divDiv.find('tr').each((_i, row) => {
      const cells = $(row).find('td');
      if (cells.length < 2) return;
      const label = $(cells[0]).text().trim();

      if (label === 'Dividenda' && dividend === null) {
        // 2nd td = most recent year value (strip any lock icons / subscription elements)
        const valCell = $(cells[2] ?? cells[1]);
        const rawText = valCell.clone().find('span, a, img').remove().end().text().trim();
        const firstLine = rawText.split('\n')[0].trim();
        dividend = parseCroatianFloat(firstLine);
      }

      if (label === 'Div. prinos' && dividend_yield === null) {
        const yieldCell = $(cells[2] ?? cells[1]);
        const rawPct = yieldCell.text().trim().replace('%', '').trim();
        dividend_yield = parseCroatianFloat(rawPct);
      }
    });

    // Fallback: search by title attribute
    if (dividend_yield === null) {
      $('td[title="Dividendni prinos"]').each((_i, el) => {
        const next = $(el).next('td');
        const rawPct = next.text().trim().replace('%', '').trim();
        const val = parseCroatianFloat(rawPct);
        if (val !== null) {
          dividend_yield = val;
          return false;
        }
      });
    }
  }

  return { name, price, market_cap, shares_outstanding, dividend, dividend_yield };
}

// Fetch Bilanca — balance sheet items by AOP number
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
    current_assets:           extractByAop($, 6),
    current_financial_assets: extractByAop($, 9),
    cash:                     extractByAop($, 10),
    total_assets:             extractByAop($, 13),
    equity:                   extractByAop($, 50),
    long_term_liabilities:    extractByAop($, 52),
    current_liabilities:      extractByAop($, 53),
  };
}

// Fetch RDG (income statement) — revenue, ebit, depreciation, net_profit
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

  const revenue     = extractByAop($, 1);
  const depreciation = extractByAop($, 17);
  const net_profit  = extractByAop($, 59);

  // EBIT: look for row whose label contains "operativna dobit" or "EBIT"
  // It doesn't have a fixed AOP number, so parse by label text
  let ebit: number | null = null;
  $('tr').each((_i, row) => {
    if (ebit !== null) return false;
    const cells = $(row).find('td');
    if (cells.length < 3) return;
    const label = $(cells[1]).text().trim().toLowerCase();
    if (label.includes('operativna dobit') || label.includes('ebit')) {
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
      ebit = parseCroatianInt(rawVal);
    }
  });

  // Fallback: EBIT = revenue - poslovni_rashodi (AOP 7)
  if (ebit === null && revenue !== null) {
    const expenses = extractByAop($, 7);
    if (expenses !== null) ebit = revenue - expenses;
  }

  return { revenue, ebit, depreciation, net_profit };
}

// Fetch Novčani tok (cash flow statement)
async function fetchNovcanTok(sifSim: string): Promise<{
  operating_cash_flow: number | null;
  capex: number | null;
}> {
  const url = `${BASE_URL}/fund/IzvFinIzv.aspx?sifSim=${sifSim}&idFinIzv=3&nacPrik=24&idAOPver=16`;
  const res = await fetchWithRetry(url);
  if (!res) return { operating_cash_flow: null, capex: null };

  const html = await res.text();
  const $ = cheerio.load(html);

  const operating_cash_flow = extractByAop($, 20);
  const capexRaw = extractByAop($, 28);
  // CapEx is typically negative (cash outflow) — store as positive
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
    // Fetch all 4 pages (sequential — mojedionice.com may throttle parallel)
    const sazetak = await fetchSazetak(sifSim);
    const bilanca = await fetchBilanca(sifSim);
    const rdg = await fetchRDG(sifSim);
    const novcanTok = await fetchNovcanTok(sifSim);

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

// Scrape all stocks with a polite delay between requests
export async function scrapeAllStocks(
  onProgress?: (ticker: string, index: number, total: number) => void
): Promise<StockData[]> {
  const tickers = await fetchAllTickers();
  console.log(`Scraping ${tickers.length} ZSE tickers from mojedionice.com`);

  const results: StockData[] = [];

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    onProgress?.(ticker, i + 1, tickers.length);

    const data = await fetchStockData(ticker);
    if (data) results.push(data);

    if (i < tickers.length - 1) {
      await new Promise((r) => setTimeout(r, 700));
    }
  }

  return results;
}
