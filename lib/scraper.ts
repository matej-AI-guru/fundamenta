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
  buffett_metric: number | null;
  buffett_undervalue: number | null;
  roce: number | null;
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

// Exceptions where sifSim doesn't follow the standard pattern
const SIFSIM_OVERRIDES: Record<string, string> = {
  'ZITO': 'ZTOS-R-B',
};

// KOEI → KOEI-R-A, KODT2 → KODT-P-A, ZITO → ZTOS-R-B
function sifSimFromTicker(ticker: string): string {
  if (SIFSIM_OVERRIDES[ticker]) return SIFSIM_OVERRIDES[ticker];
  if (ticker.endsWith('2')) return `${ticker.slice(0, -1)}-P-A`;
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

const FETCH_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'hr-HR,hr;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  Referer: 'https://www.mojedionice.com/',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0',
};

// Module-level ASP.NET session cookie — shared within one serverless invocation.
let _sessionCookie: string | null = null;
let _sessionEstablished = false;

async function ensureSession(): Promise<void> {
  if (_sessionEstablished) return;
  _sessionEstablished = true;
  try {
    // Step 1: hit homepage with redirect:'manual' to capture the Set-Cookie header
    const res = await fetch(`${BASE_URL}/`, {
      headers: FETCH_HEADERS,
      redirect: 'manual',
      cache: 'no-store',
    });
    const setCookie = res.headers.get('set-cookie') ?? '';
    const match = setCookie.match(/ASP\.NET_SessionId=([^;]+)/i);
    if (match) {
      _sessionCookie = match[1];
      console.log(`[session] ASP.NET_SessionId established`);
      // Step 2: follow the redirect (if any) so the server registers our session
      const location = res.headers.get('location');
      if (location) {
        const fullUrl = location.startsWith('http') ? location : `${BASE_URL}${location}`;
        await fetch(fullUrl, {
          headers: { ...FETCH_HEADERS, Cookie: `ASP.NET_SessionId=${_sessionCookie}` },
          cache: 'no-store',
          redirect: 'follow',
        });
      }
    } else {
      console.warn('[session] No ASP.NET_SessionId found in Set-Cookie — proceeding without session');
    }
  } catch (err) {
    console.warn(`[session] Failed to establish session: ${err}`);
    // Proceed anyway — maybe requests will work without cookie
  }
}

function getHeaders(): Record<string, string> {
  return _sessionCookie
    ? { ...FETCH_HEADERS, Cookie: `ASP.NET_SessionId=${_sessionCookie}` }
    : FETCH_HEADERS;
}

async function fetchWithRetry(url: string): Promise<Response | null> {
  await ensureSession();
  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5_000);
    try {
      const res = await fetch(url, { headers: getHeaders(), cache: 'no-store', signal: controller.signal });
      clearTimeout(t);
      // Detect bot-protection redirect to poruka.aspx (fetch follows 302 → 200 silently)
      if (res.url.includes('poruka.aspx')) {
        console.warn(`[blocked] Redirected to poruka.aspx for: ${url}`);
        return null;
      }
      if (res.ok) return res;
      console.warn(`[attempt ${attempt}] ${url}: HTTP ${res.status}`);
      if (res.status >= 500 && attempt < 3) {
        await new Promise((r) => setTimeout(r, 2_000));
        continue;
      }
      return null;
    } catch (err) {
      clearTimeout(t);
      // Timeout or network error — fail fast, no retry
      console.warn(`${url}: fetch failed — ${err}`);
      return null;
    }
  }
  return null;
}

// Extract value from a financial statement table by AOP number.
//
// Two table formats exist on mojedionice.com:
//   Bilanca (no nacPrik):  td[0]=AOP, td[1]=label,    td[2]=most recent value
//   RDG/CF (nacPrik=24):  td[0]=seq, td[1]=AOP code, td[2]=description, td[3]=most recent value
//
// Strategy: prefer a match in cells[1] (RDG format, AOP often zero-padded like "001"),
// fall back to cells[0] (Bilanca format).  Value is always at aopColIdx + 2.
//
// DO NOT use the tooltip — Bilanca tooltips contain absolute EUR while the cell
// shows thousands, causing 1000× double-scaling.
function extractByAop(
  $: ReturnType<typeof cheerio.load>,
  aop: number,
  scale = 1
): number | null {
  // Try the exact number and zero-padded variants (e.g. 1 → "1", "01", "001")
  const aopStrs = [
    String(aop),
    String(aop).padStart(2, '0'),
    String(aop).padStart(3, '0'),
  ];

  let result: number | null = null;

  $('tr').each((_i, row) => {
    if (result !== null) return false;
    const cells = $(row).find('td');
    if (cells.length < 3) return;

    // Priority 1: cells[1] contains the AOP code → RDG/CF format (value at col 3)
    // Priority 2: cells[0] contains the AOP code → Bilanca format (value at col 2)
    let aopColIdx = -1;
    if (aopStrs.includes($(cells[1]).text().trim())) {
      aopColIdx = 1;
    } else if (aopStrs.includes($(cells[0]).text().trim())) {
      aopColIdx = 0;
    }
    if (aopColIdx === -1) return;

    const valueColIdx = aopColIdx + 2; // always 2 columns after the AOP cell
    if (valueColIdx >= cells.length) return;

    // Use cell text directly — no tooltip (tooltip has wrong scale for Bilanca)
    const rawVal = $(cells[valueColIdx]).text().trim().split(/\s/)[0];
    const num = parseCroatianNum(rawVal);
    if (num !== null) result = num * scale;
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

  // Company name — title format: "ACI-R-A (ACI D.D.) - MojeDionice"
  const titleText = $('title').text().trim();
  const parenMatch = titleText.match(/\(([^)]+)\)/);
  const name = parenMatch ? parenMatch[1].trim() : sifSim;

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

// Label-based fallback for Bilanca tables with non-standard AOP numbering.
// Some companies (e.g. SPAN, IG) use an extended chart-of-accounts where the label cell
// contains extra text like "KAPITAL I REZERVE (AOP 068 do 070+...)" — so we match by prefix
// rather than exact equality (e.g. cell starts with our label, optionally followed by space/paren).
function extractByLabel(
  $: ReturnType<typeof cheerio.load>,
  labels: string[],
  scale = 1
): number | null {
  const normalized = labels.map((l) => l.toLowerCase());
  let result: number | null = null;
  $('tr').each((_i, row) => {
    if (result !== null) return false;
    const cells = $(row).find('td');
    if (cells.length < 3) return;
    const cellLabel = $(cells[1]).text().trim().toLowerCase();
    const matches = normalized.some(
      (label) =>
        cellLabel === label ||
        cellLabel.startsWith(label + ' ') ||
        cellLabel.startsWith(label + '(')
    );
    if (matches) {
      const rawVal = $(cells[2]).text().trim().split(/\s/)[0];
      const num = parseCroatianNum(rawVal);
      if (num !== null) result = num * scale;
    }
  });
  return result;
}

type BilancaResult = {
  total_assets: number | null;
  equity: number | null;
  current_assets: number | null;
  current_financial_assets: number | null;
  cash: number | null;
  long_term_liabilities: number | null;
  current_liabilities: number | null;
};

// Tickers that use banking balance sheet format (AOP 1/3/5, always in thousands EUR)
const BANK_TICKERS = new Set(['HPB', 'IKBA', 'SNBA', 'ZABA']);

// Tickers that are insurance companies — different balance sheet, skip current assets/liabilities
const INSURANCE_TICKERS = new Set(['CROS', 'CROS2']);

// Returns null if value is outside realistic bounds — catches parsing errors that produce
// absurd ratios (e.g. near-zero equity blowing up P/B, wrong AOP giving tiny liabilities)
function sanity(v: number | null, min: number, max: number): number | null {
  return v !== null && v >= min && v <= max ? v : null;
}

// Fetch Bilanca for banks — they use bank-specific AOP numbering:
//   AOP 1 = Gotovina (Cash), AOP 3 = Ukupno aktiva, AOP 5 = Kapital i rezerve
// Label-based fallback handles variations in bank statement formatting.
// Current assets/liabilities are not applicable for banks.
async function fetchBilancaBank(sifSim: string): Promise<BilancaResult> {
  const empty: BilancaResult = {
    total_assets: null, equity: null, current_assets: null,
    current_financial_assets: null, cash: null,
    long_term_liabilities: null, current_liabilities: null,
  };
  const url = `${BASE_URL}/fund/IzvFinIzv.aspx?sifSim=${sifSim}&idFinIzv=1`;
  const res = await fetchWithRetry(url);
  if (!res) return empty;

  const html = await res.text();
  const $ = cheerio.load(html);
  const scale = 1000; // Banks always report in thousands of EUR

  const byAop = (aop: number) => extractByAop($, aop, scale);
  const byLabel = (...labels: string[]) => extractByLabel($, labels, scale);

  return {
    ...empty,
    cash:         byAop(1) ?? byLabel('gotovina i gotovinski ekvivalenti', 'gotovina i novčanica', 'gotovina'),
    total_assets: byAop(3) ?? byLabel('ukupno aktiva', 'ukupna imovina', 'ukupna aktiva', 'imovina'),
    equity:       byAop(5) ?? byLabel('kapital i rezerve', 'dionički kapital i rezerve', 'kapital'),
  };
}

// Fetch Bilanca — balance sheet items by AOP number.
// Scale depends on company: page says "u tisućama eura" (×1000) or "u eurima" (×1).
// Falls back to label-based matching for companies with non-standard AOP numbering.
async function fetchBilanca(sifSim: string): Promise<BilancaResult> {
  const empty: BilancaResult = {
    total_assets: null, equity: null, current_assets: null,
    current_financial_assets: null, cash: null,
    long_term_liabilities: null, current_liabilities: null,
  };
  const url = `${BASE_URL}/fund/IzvFinIzv.aspx?sifSim=${sifSim}&idFinIzv=1`;
  const res = await fetchWithRetry(url);
  if (!res) return empty;

  const html = await res.text();
  const $ = cheerio.load(html);

  // Detect unit: "u tisućama eura" → multiply by 1000; "u eurima" → ×1
  const scale = html.toLowerCase().includes('tisu') ? 1000 : 1;

  const byAop = (aop: number) => extractByAop($, aop, scale);
  const byLabel = (...labels: string[]) => extractByLabel($, labels, scale);

  return {
    current_assets:           byAop(6)  ?? byLabel('kratkotrajna imovina'),
    current_financial_assets: byAop(9)  ?? byLabel('kratkotrajna financijska imovina'),
    cash:                     byAop(10) ?? byLabel('novac na računima i u blagajni', 'gotovina'),
    total_assets:             byAop(13) ?? byLabel('ukupno aktiva', 'ukupna aktiva'),
    equity:                   byAop(50) ?? byLabel('kapital i rezerve'),
    long_term_liabilities:    byAop(52) ?? byLabel('dugoročne obveze'),
    current_liabilities:      byAop(53) ?? byLabel('kratkoročne obveze'),
  };
}

// Fetch RDG for banks/insurance — different AOP scheme, data in thousands EUR
// Uses label-based search; no nacPrik=24 (that param only works for standard GFI-POD)
async function fetchRDGBank(sifSim: string): Promise<{
  revenue: number | null;
  ebit: number | null;
  depreciation: number | null;
  net_profit: number | null;
}> {
  const empty = { revenue: null, ebit: null, depreciation: null, net_profit: null };
  const url = `${BASE_URL}/fund/IzvFinIzv.aspx?sifSim=${sifSim}&idFinIzv=2`;
  const res = await fetchWithRetry(url);
  if (!res) return empty;

  const html = await res.text();
  const $ = cheerio.load(html);
  const scale = html.toLowerCase().includes('tisu') ? 1000 : 1;
  const byLabel = (...labels: string[]) => extractByLabel($, labels, scale);

  const net_profit = byLabel(
    'dobit (gubitak) poslovne godine',
    'dobit tekuće godine',
    'neto dobit tekuće godine',
    'dobit ili gubitak za godinu',
    'dobit poslovne godine',
    'neto dobit',
  );

  const revenue = byLabel(
    'ukupni prihodi',
    'ukupno prihodi',
    'prihodi iz redovnih aktivnosti',
    'neto prihodi od redovnih aktivnosti',
    'kamatni prihodi i slični prihodi',
    'kamatni prihodi',
  );

  return { ...empty, revenue, net_profit };
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

  // EBIT: search by label.
  // RDG table format (nacPrik=24): td[0]=seq, td[1]=AOP, td[2]=description, td[3]=value
  let ebit: number | null = null;
  $('tr').each((_i, row) => {
    if (ebit !== null) return false;
    const cells = $(row).find('td');
    if (cells.length < 4) return;
    // Description is in cells[2] for nacPrik=24 format
    const label = $(cells[2]).text().trim().toLowerCase();
    if (label.includes('operativna dobit') || label === 'ebit') {
      const rawVal = $(cells[3]).text().trim().split(/\s/)[0]; // value in cells[3]
      const num = parseCroatianNum(rawVal);
      ebit = num; // scale = 1 (nacPrik=24 is absolute EUR)
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

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  try {
    // Fetch 4 pages sequentially with 400ms gap — parallel bursts trigger rate-limiting
    const sazetak   = await fetchSazetak(sifSim);   await delay(400);
    const isFinancial = BANK_TICKERS.has(ticker) || INSURANCE_TICKERS.has(ticker);
    const bilanca   = await (isFinancial ? fetchBilancaBank : fetchBilanca)(sifSim); await delay(400);
    const rdg       = await (isFinancial ? fetchRDGBank : fetchRDG)(sifSim); await delay(400);
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

    // Novac + Kratkotrajna fin. imovina + EBIT × 10
    const buffett_metric =
      cash !== null && current_financial_assets !== null && ebit !== null
        ? cash + current_financial_assets + ebit * 10
        : null;

    // Buffett metrika / Tržišna kapitalizacija - 1
    const buffett_undervalue =
      buffett_metric !== null && market_cap !== null && market_cap !== 0
        ? buffett_metric / market_cap - 1
        : null;

    // EBIT / (Aktiva - Kratkoročne obveze) × 100
    const roce =
      ebit !== null && total_assets !== null && current_liabilities !== null &&
      (total_assets - current_liabilities) !== 0
        ? (ebit / (total_assets - current_liabilities)) * 100
        : null;

    // Sanity caps — null-out ratios that are astronomically large/small due to parsing errors
    // (e.g. near-zero equity exploding P/B, wrong AOP giving near-zero liabilities)
    const pe_ratio_safe      = sanity(pe_ratio,      -500,  2000);
    const pb_ratio_safe      = sanity(pb_ratio,         0,   200);
    const ps_ratio_safe      = sanity(ps_ratio,         0,   500);
    const pcf_ratio_safe     = sanity(pcf_ratio,     -500,  2000);
    const pfcf_ratio_safe    = sanity(pfcf_ratio,    -500,  2000);
    const ev_ebitda_safe     = sanity(ev_ebitda,     -100,   500);
    const roe_safe           = sanity(roe,           -500,  2000);
    const roce_safe          = sanity(roce,          -200,  2000);
    const current_ratio_safe = sanity(current_ratio,    0,    50);
    const earnings_yield_safe = sanity(earnings_yield, -200,  200);

    // Skip if we got essentially nothing
    const hasData = [price, market_cap, revenue, net_profit, pe_ratio_safe].some(
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
      buffett_metric,
      buffett_undervalue,
      roce:             roce_safe,
      eps,
      book_value_per_share,
      pe_ratio:         pe_ratio_safe,
      pb_ratio:         pb_ratio_safe,
      ps_ratio:         ps_ratio_safe,
      pcf_ratio:        pcf_ratio_safe,
      pfcf_ratio:       pfcf_ratio_safe,
      net_margin,
      roe:              roe_safe,
      earnings_yield:   earnings_yield_safe,
      revenue_per_share,
      free_cash_flow,
      ev_ebitda:        ev_ebitda_safe,
      current_ratio:    current_ratio_safe,
      currency: 'EUR',
    };
  } catch (err) {
    console.error(`Error fetching ${ticker} (${sifSim}):`, err);
    return null;
  }
}

// Scrape a slice of ZSE stocks.
//
// mojedionice.com rate-limits to ~10 tickers (40 HTTP requests) per session.
// To scrape all 47 tickers, the cron is split into 5 separate invocations each
// covering 10 tickers: offsets 0, 10, 20, 30, 40 at 10-minute intervals.
//
// CONCURRENCY=2 within each run to keep burst traffic modest.
export async function scrapeAllStocks(
  onProgress?: (ticker: string, index: number, total: number) => void,
  offset = 0,
  limit?: number
): Promise<StockData[]> {
  // Reset session so a fresh cookie is established for every scrape run.
  // This prevents stale/expired sessions on warm Vercel instances.
  _sessionCookie = null;
  _sessionEstablished = false;

  const allTickers = await fetchAllTickers();
  const tickers = limit !== undefined
    ? allTickers.slice(offset, offset + limit)
    : allTickers.slice(offset);
  console.log(`Scraping tickers ${offset}–${offset + tickers.length - 1} (${tickers.length} total) from mojedionice.com`);

  const results: StockData[] = [];

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    onProgress?.(ticker, i + 1, tickers.length);
    const result = await fetchStockData(ticker);
    if (result) results.push(result);

    if (i + 1 < tickers.length) {
      await new Promise((r) => setTimeout(r, 1_500));
    }
  }

  return results;
}
