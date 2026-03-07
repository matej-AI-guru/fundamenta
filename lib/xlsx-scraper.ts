import * as XLSX from 'xlsx';

const HRK_TO_EUR = 7.5345;

// Extended financial data from XLSX TFI-POD/GFI-POD reports
export interface XlsxFinancialData {
  ticker: string;
  year: number;
  period: string;       // 'FY' | 'Q1' | 'Q2' | 'Q3' | 'Q4'
  source: string;       // 'xlsx'
  report_type: string;  // 'TFI-POD' | 'GFI-POD'

  // --- Bilanca ---
  non_current_assets: number | null;       // AOP 002 - Dugotrajna imovina
  intangible_assets: number | null;        // AOP 003 - Nematerijalna imovina
  tangible_assets: number | null;          // AOP 010 - Materijalna imovina
  current_assets: number | null;           // AOP 037 - Kratkotrajna imovina
  inventories: number | null;              // AOP 038 - Zalihe
  receivables: number | null;              // AOP 046 - Kratkotrajna potraživanja
  current_financial_assets: number | null; // AOP 053 - Kratkotrajna financijska imovina
  cash: number | null;                     // AOP 063 - Novac u banci i blagajni
  total_assets: number | null;             // AOP 065 - Ukupno aktiva
  share_capital: number | null;            // AOP 068 - Temeljni (upisani) kapital
  retained_earnings: number | null;        // AOP 083 - Zadržana dobit ili preneseni gubitak
  equity: number | null;                   // AOP 067 - Kapital i rezerve
  provisions: number | null;               // AOP 090 - Rezerviranja
  long_term_liabilities: number | null;    // AOP 097 - Dugoročne obveze
  current_liabilities: number | null;      // AOP 109 - Kratkoročne obveze

  // --- RDG ---
  revenue: number | null;                  // Poslovni prihodi
  other_operating_income: number | null;   // Ostali poslovni prihodi (izvan grupe)
  material_costs: number | null;           // Materijalni troškovi
  personnel_costs: number | null;          // Troškovi osoblja
  depreciation: number | null;             // Amortizacija
  operating_expenses: number | null;       // Poslovni rashodi
  operating_profit: number | null;         // Calculated: revenue - operating_expenses
  financial_income: number | null;         // Financijski prihodi
  financial_expenses: number | null;       // Financijski rashodi
  profit_before_tax: number | null;        // Dobit prije oporezivanja
  income_tax: number | null;              // Porez na dobit
  net_profit: number | null;              // Dobit/gubitak razdoblja

  // --- Novčani tok (Direct method - NT_D) ---
  operating_cash_flow: number | null;      // Neto novčani tok od poslovnih aktivnosti
  investing_cash_flow: number | null;      // Neto novčani tok od investicijskih aktivnosti
  capex: number | null;                   // Novčani izdaci za kupnju dugotrajne imovine
  financing_cash_flow: number | null;      // Neto novčani tok od financijskih aktivnosti
  dividends_paid: number | null;           // Novčani izdaci za isplatu dividendi

  // --- Izračunato ---
  ebit: number | null;
  ebitda: number | null;
  free_cash_flow: number | null;
  net_margin: number | null;
  roe: number | null;
  roce: number | null;
  current_ratio: number | null;
  eps: number | null;
}

interface AopMapping {
  aop: number;
  field: string;
}

// Bilanca AOP numbers — common fields stable across both old and new schemes
const BILANCA_AOPS_BASE: AopMapping[] = [
  { aop: 2,   field: 'non_current_assets' },
  { aop: 3,   field: 'intangible_assets' },
  { aop: 10,  field: 'tangible_assets' },
  { aop: 37,  field: 'current_assets' },
  { aop: 38,  field: 'inventories' },
  { aop: 46,  field: 'receivables' },
  { aop: 53,  field: 'current_financial_assets' },
  { aop: 63,  field: 'cash' },
  { aop: 65,  field: 'total_assets' },
  { aop: 67,  field: 'equity' },   // total equity (parent + minority) — same AOP in both schemes
  { aop: 68,  field: 'share_capital' },
  { aop: 109, field: 'current_liabilities' },
];

// NEW bilanca scheme (2021+): minority interest at AOP 089, provisions at AOP 090
const BILANCA_AOPS_NEW: AopMapping[] = [
  ...BILANCA_AOPS_BASE,
  { aop: 83,  field: 'retained_earnings' },
  { aop: 89,  field: 'minority_equity' }, // VIII. MANJINSKI INTERES
  { aop: 90,  field: 'provisions' },
  { aop: 97,  field: 'long_term_liabilities' },
];

// OLD bilanca scheme (pre-2021): minority interest at AOP 087, provisions at AOP 088
const BILANCA_AOPS_OLD: AopMapping[] = [
  ...BILANCA_AOPS_BASE,
  { aop: 81,  field: 'retained_earnings' }, // VI. ZADRŽANA DOBIT (aggregate)
  { aop: 87,  field: 'minority_equity' }, // VIII. MANJINSKI INTERES
  { aop: 88,  field: 'provisions' },
  { aop: 95,  field: 'long_term_liabilities' },
];

// NEW RDG AOP scheme (2021+)
const RDG_AOPS_NEW: AopMapping[] = [
  { aop: 1,   field: 'revenue' },
  { aop: 6,   field: 'other_operating_income' },
  { aop: 7,   field: 'operating_expenses' },
  { aop: 9,   field: 'material_costs' },
  { aop: 13,  field: 'personnel_costs' },
  { aop: 17,  field: 'depreciation' },
  { aop: 30,  field: 'financial_income' },
  { aop: 41,  field: 'financial_expenses' },
  { aop: 55,  field: 'profit_before_tax' },
  { aop: 58,  field: 'income_tax' },
  { aop: 59,  field: 'net_profit' },      // total group profit (incl. minority)
  { aop: 76,  field: 'net_profit_parent' }, // profit attributable to parent (imatelji kapitala matice)
];

// OLD RDG AOP scheme (2019-2020)
const RDG_AOPS_OLD: AopMapping[] = [
  { aop: 125, field: 'revenue' },
  { aop: 130, field: 'other_operating_income' },
  { aop: 131, field: 'operating_expenses' },
  { aop: 133, field: 'material_costs' },
  { aop: 137, field: 'personnel_costs' },
  { aop: 141, field: 'depreciation' },
  { aop: 154, field: 'financial_income' },
  { aop: 165, field: 'financial_expenses' },
  { aop: 180, field: 'profit_before_tax' },
  { aop: 182, field: 'income_tax' },
  { aop: 183, field: 'net_profit' },       // total group profit (incl. minority)
  { aop: 200, field: 'net_profit_parent' }, // profit attributable to parent (imatelji kapitala matice)
];

// NEW NT_D AOP scheme (2021+)
const NT_D_AOPS_NEW: AopMapping[] = [
  { aop: 14, field: 'operating_cash_flow' },
  { aop: 22, field: 'capex' },
  { aop: 28, field: 'investing_cash_flow' },
  { aop: 35, field: 'dividends_paid' },
  { aop: 40, field: 'financing_cash_flow' },
];

// OLD NT_D AOP scheme (2019-2020)
const NT_D_AOPS_OLD: AopMapping[] = [
  { aop: 12, field: 'operating_cash_flow' },
  { aop: 20, field: 'capex' },
  { aop: 26, field: 'investing_cash_flow' },
  { aop: 33, field: 'dividends_paid' },
  { aop: 38, field: 'financing_cash_flow' },
];

function extractAopValues(
  rows: unknown[][],
  aopMappings: AopMapping[],
  aopCol: number,
  valueCol: number
): Record<string, number | null> {
  const result: Record<string, number | null> = {};

  // Build a lookup: AOP number → field name
  const aopToField: Record<number, string> = {};
  for (const m of aopMappings) {
    aopToField[m.aop] = m.field;
    result[m.field] = null; // init all to null
  }

  // Track which AOP numbers we've already found (first match wins — avoids
  // the header row "1, ..., 2, 3, 4" being picked up as AOP 2)
  const found = new Set<number>();

  for (const row of rows) {
    // Skip column-number header rows like [1,"","","","","",2,3,4]
    if (typeof row[0] === 'number') continue;

    const aopRaw = row[aopCol];
    if (typeof aopRaw !== 'number' || aopRaw <= 0) continue;

    const aop = aopRaw;
    const field = aopToField[aop];
    if (!field || found.has(aop)) continue;

    const val = row[valueCol];
    if (typeof val === 'number') {
      result[field] = val;
      found.add(aop);
    } else if (typeof val === 'string') {
      const parsed = parseFloat(val.replace(/\s/g, '').replace(',', '.'));
      if (!isNaN(parsed)) {
        result[field] = parsed;
        found.add(aop);
      }
    }
  }

  return result;
}

function detectYear(rows: unknown[][]): number {
  // Look for year in the first few rows, e.g. "stanje na dan 31.12.2025" or "Godina: 2025"
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const rowStr = rows[i].join(' ');
    const match = rowStr.match(/\b(20\d{2})\b/);
    if (match) return parseInt(match[1]);
  }
  return new Date().getFullYear() - 1;
}

function detectCurrency(rows: unknown[][]): 'EUR' | 'HRK' {
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const rowStr = String(rows[i]?.join(' ') || '').toLowerCase();
    if (rowStr.includes('kunama') || rowStr.includes('kuna')) return 'HRK';
    if (rowStr.includes('eurima') || rowStr.includes('euro')) return 'EUR';
  }
  return 'EUR'; // default
}

function detectAopScheme(rdgRows: unknown[][]): 'old' | 'new' {
  // Check first data AOP in RDG: if >= 125 → old scheme, if < 10 → new scheme
  for (const row of rdgRows) {
    if (typeof row[0] === 'number') continue;
    if (typeof row[6] === 'number' && row[6] > 0) {
      return row[6] >= 100 ? 'old' : 'new';
    }
  }
  return 'new';
}

function convertToEur(values: Record<string, number | null>): Record<string, number | null> {
  const result: Record<string, number | null> = {};
  for (const [key, val] of Object.entries(values)) {
    result[key] = val !== null ? Math.round(val / HRK_TO_EUR) : null;
  }
  return result;
}

function findSheet(wb: XLSX.WorkBook, ...names: string[]): XLSX.WorkSheet | null {
  for (const name of names) {
    const found = wb.SheetNames.find(
      s => s.toLowerCase().includes(name.toLowerCase())
    );
    if (found) return wb.Sheets[found];
  }
  return null;
}

export async function scrapeXlsx(
  xlsxUrl: string,
  ticker: string,
  reportType: string = 'TFI-POD',
  sharesOutstanding: number | null = null
): Promise<XlsxFinancialData[]> {
  console.log(`[xlsx] Fetching ${xlsxUrl}`);

  const res = await fetch(xlsxUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });
  if (!res.ok) {
    console.error(`[xlsx] HTTP ${res.status} for ${xlsxUrl}`);
    return [];
  }

  const buf = await res.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });

  console.log(`[xlsx] Sheets: ${wb.SheetNames.join(', ')}`);

  // Find sheets
  const bilancaWs = findSheet(wb, 'Bilanca');
  const rdgWs = findSheet(wb, 'RDG');
  const ntdWs = findSheet(wb, 'NT_D', 'NT-D', 'Novčani tok');

  if (!bilancaWs || !rdgWs) {
    console.error('[xlsx] Missing Bilanca or RDG sheet');
    return [];
  }

  const bilancaRows = XLSX.utils.sheet_to_json(bilancaWs, { header: 1, defval: '' }) as unknown[][];
  const rdgRows = XLSX.utils.sheet_to_json(rdgWs, { header: 1, defval: '' }) as unknown[][];
  const ntdRows = ntdWs
    ? (XLSX.utils.sheet_to_json(ntdWs, { header: 1, defval: '' }) as unknown[][])
    : [];

  const year = detectYear(bilancaRows);
  const currency = detectCurrency(bilancaRows);
  const aopScheme = detectAopScheme(rdgRows);
  const isHrk = currency === 'HRK';

  const rdgAops = aopScheme === 'old' ? RDG_AOPS_OLD : RDG_AOPS_NEW;
  const ntdAops = aopScheme === 'old' ? NT_D_AOPS_OLD : NT_D_AOPS_NEW;
  const bilancaAops = aopScheme === 'old' ? BILANCA_AOPS_OLD : BILANCA_AOPS_NEW;

  console.log(`[xlsx] Year: ${year}, Currency: ${currency}, AOP scheme: ${aopScheme}`);

  const results: XlsxFinancialData[] = [];

  // Extract for both years: current (yearOffset=0) and previous (yearOffset=1)
  for (const yearOffset of [0, 1]) {
    const yr = yearOffset === 0 ? year : year - 1;

    // Bilanca: AOP in col 6, prev=col 7, curr=col 8
    const bilancaValueCol = yearOffset === 0 ? 8 : 7;
    let bilanca = extractAopValues(bilancaRows, bilancaAops, 6, bilancaValueCol);

    // RDG: AOP in col 6, prev cumul=col 7, curr cumul=col 9
    const rdgValueCol = yearOffset === 0 ? 9 : 7;
    let rdg = extractAopValues(rdgRows, rdgAops, 6, rdgValueCol);

    // NT_D: AOP in col 6, prev=col 7, curr=col 8
    const ntdValueCol = yearOffset === 0 ? 8 : 7;
    let ntd = ntdRows.length > 0
      ? extractAopValues(ntdRows, ntdAops, 6, ntdValueCol)
      : { operating_cash_flow: null, capex: null, investing_cash_flow: null, dividends_paid: null, financing_cash_flow: null };

    // Convert HRK to EUR if needed
    if (isHrk) {
      bilanca = convertToEur(bilanca);
      rdg = convertToEur(rdg);
      ntd = convertToEur(ntd);
    }

    // Calculated fields
    const revenue = rdg.revenue as number | null;
    const opExpenses = rdg.operating_expenses as number | null;
    const depreciation = rdg.depreciation as number | null;
    // For consolidated (TFI-POD): use profit attributable to parent shareholders (AOP 60/184).
    // For individual (GFI-POD): net_profit_parent is null → fall back to net_profit (AOP 59/183).
    const netProfit = (rdg.net_profit_parent as number | null) ?? (rdg.net_profit as number | null);
    // For consolidated: equity = parent equity only (total equity minus minority interest AOP 85).
    // For individual: minority_equity is null → equity stays as total.
    const totalEquity = bilanca.equity as number | null;
    const minorityEquity = bilanca.minority_equity as number | null;
    const equityVal = totalEquity !== null ? totalEquity - (minorityEquity ?? 0) : null;
    const totalAssets = bilanca.total_assets as number | null;
    const currentLiab = bilanca.current_liabilities as number | null;
    const currentAssets = bilanca.current_assets as number | null;
    const ocf = ntd.operating_cash_flow as number | null;
    const capexVal = ntd.capex as number | null;

    const ebit = revenue !== null && opExpenses !== null ? revenue - opExpenses : null;
    const ebitda = ebit !== null ? ebit + (depreciation ?? 0) : null;
    const fcf = ocf !== null && capexVal !== null ? ocf - Math.abs(capexVal) : null;
    const netMargin = revenue && netProfit !== null && revenue !== 0 ? (netProfit / revenue) * 100 : null;
    const roe = equityVal && netProfit !== null && equityVal !== 0 ? (netProfit / equityVal) * 100 : null;
    const roce = ebit !== null && totalAssets !== null && currentLiab !== null && (totalAssets - currentLiab) !== 0
      ? (ebit / (totalAssets - currentLiab)) * 100 : null;
    const currentRatio = currentAssets !== null && currentLiab && currentLiab !== 0
      ? currentAssets / currentLiab : null;
    const eps = netProfit !== null && sharesOutstanding && sharesOutstanding !== 0
      ? netProfit / sharesOutstanding : null;

    results.push({
      ticker,
      year: yr,
      period: 'FY',
      source: 'xlsx',
      report_type: reportType,

      // Bilanca
      non_current_assets: bilanca.non_current_assets as number | null,
      intangible_assets: bilanca.intangible_assets as number | null,
      tangible_assets: bilanca.tangible_assets as number | null,
      current_assets: currentAssets,
      inventories: bilanca.inventories as number | null,
      receivables: bilanca.receivables as number | null,
      current_financial_assets: bilanca.current_financial_assets as number | null,
      cash: bilanca.cash as number | null,
      total_assets: totalAssets,
      share_capital: bilanca.share_capital as number | null,
      retained_earnings: bilanca.retained_earnings as number | null,
      equity: equityVal,
      provisions: bilanca.provisions as number | null,
      long_term_liabilities: bilanca.long_term_liabilities as number | null,
      current_liabilities: currentLiab,

      // RDG
      revenue,
      other_operating_income: rdg.other_operating_income as number | null,
      material_costs: rdg.material_costs as number | null,
      personnel_costs: rdg.personnel_costs as number | null,
      depreciation,
      operating_expenses: opExpenses,
      operating_profit: ebit, // EBIT = revenue - operating_expenses
      financial_income: rdg.financial_income as number | null,
      financial_expenses: rdg.financial_expenses as number | null,
      profit_before_tax: rdg.profit_before_tax as number | null,
      income_tax: rdg.income_tax as number | null,
      net_profit: netProfit,

      // Cash flow
      operating_cash_flow: ocf,
      investing_cash_flow: ntd.investing_cash_flow as number | null,
      capex: capexVal !== null ? Math.abs(capexVal) : null,
      financing_cash_flow: ntd.financing_cash_flow as number | null,
      dividends_paid: ntd.dividends_paid as number | null,

      // Calculated
      ebit,
      ebitda,
      free_cash_flow: fcf,
      net_margin: netMargin,
      roe,
      roce,
      current_ratio: currentRatio,
      eps,
    });
  }

  return results;
}

// --- Quarterly scraping support ---

// Flow fields (RDG + cash flow) that need de-cumulation.
// Balance sheet fields are point-in-time snapshots — no de-cumulation needed.
const FLOW_FIELDS = [
  'revenue', 'other_operating_income', 'material_costs', 'personnel_costs',
  'depreciation', 'operating_expenses', 'financial_income',
  'financial_expenses', 'profit_before_tax', 'income_tax', 'net_profit',
  'net_profit_parent', // also de-cumulate parent-only profit for quarterly standalone
  'operating_cash_flow', 'investing_cash_flow', 'capex', 'financing_cash_flow',
  'dividends_paid',
];

export { FLOW_FIELDS };

/**
 * Extract raw (cumulative) data from a single XLSX report without computing derived metrics.
 * Returns the raw field values for the current period (yearOffset=0) only.
 */
async function extractRawFromXlsx(
  xlsxUrl: string,
  ticker: string,
  reportType: string,
): Promise<{
  year: number;
  bilanca: Record<string, number | null>;
  rdg: Record<string, number | null>;
  ntd: Record<string, number | null>;
  isHrk: boolean;
} | null> {
  console.log(`[xlsx-q] Fetching ${xlsxUrl}`);
  const res = await fetch(xlsxUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  if (!res.ok) {
    console.error(`[xlsx-q] HTTP ${res.status} for ${xlsxUrl}`);
    return null;
  }

  const buf = await res.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });

  const bilancaWs = findSheet(wb, 'Bilanca');
  const rdgWs = findSheet(wb, 'RDG');
  const ntdWs = findSheet(wb, 'NT_D', 'NT-D', 'Novčani tok');

  if (!bilancaWs || !rdgWs) {
    console.error('[xlsx-q] Missing Bilanca or RDG sheet');
    return null;
  }

  const bilancaRows = XLSX.utils.sheet_to_json(bilancaWs, { header: 1, defval: '' }) as unknown[][];
  const rdgRows = XLSX.utils.sheet_to_json(rdgWs, { header: 1, defval: '' }) as unknown[][];
  const ntdRows = ntdWs
    ? (XLSX.utils.sheet_to_json(ntdWs, { header: 1, defval: '' }) as unknown[][])
    : [];

  const year = detectYear(bilancaRows);
  const currency = detectCurrency(bilancaRows);
  const aopScheme = detectAopScheme(rdgRows);
  const isHrk = currency === 'HRK';

  const rdgAops = aopScheme === 'old' ? RDG_AOPS_OLD : RDG_AOPS_NEW;
  const ntdAops = aopScheme === 'old' ? NT_D_AOPS_OLD : NT_D_AOPS_NEW;
  const bilancaAops = aopScheme === 'old' ? BILANCA_AOPS_OLD : BILANCA_AOPS_NEW;

  // Current period only (yearOffset=0)
  let bilanca = extractAopValues(bilancaRows, bilancaAops, 6, 8);
  let rdg = extractAopValues(rdgRows, rdgAops, 6, 9);
  let ntd = ntdRows.length > 0
    ? extractAopValues(ntdRows, ntdAops, 6, 8)
    : { operating_cash_flow: null, capex: null, investing_cash_flow: null, dividends_paid: null, financing_cash_flow: null };

  if (isHrk) {
    bilanca = convertToEur(bilanca);
    rdg = convertToEur(rdg);
    ntd = convertToEur(ntd);
  }

  return { year, bilanca, rdg, ntd, isHrk };
}

/**
 * Build an XlsxFinancialData record from raw field values.
 */
function buildFinancialRecord(
  ticker: string,
  year: number,
  period: string,
  reportType: string,
  bilanca: Record<string, number | null>,
  rdg: Record<string, number | null>,
  ntd: Record<string, number | null>,
  sharesOutstanding: number | null,
): XlsxFinancialData {
  const revenue = rdg.revenue as number | null;
  const opExpenses = rdg.operating_expenses as number | null;
  const depreciation = rdg.depreciation as number | null;
  // For consolidated (TFI-POD): use profit attributable to parent shareholders (AOP 60/184).
  const netProfit = (rdg.net_profit_parent as number | null) ?? (rdg.net_profit as number | null);
  // For consolidated: equity = parent equity only (total equity minus minority interest AOP 85).
  const totalEquity = bilanca.equity as number | null;
  const minorityEquity = bilanca.minority_equity as number | null;
  const equityVal = totalEquity !== null ? totalEquity - (minorityEquity ?? 0) : null;
  const totalAssets = bilanca.total_assets as number | null;
  const currentLiab = bilanca.current_liabilities as number | null;
  const currentAssets = bilanca.current_assets as number | null;
  const ocf = ntd.operating_cash_flow as number | null;
  const capexVal = ntd.capex as number | null;

  const ebit = revenue !== null && opExpenses !== null ? revenue - opExpenses : null;
  const ebitda = ebit !== null ? ebit + (depreciation ?? 0) : null;
  const fcf = ocf !== null && capexVal !== null ? ocf - Math.abs(capexVal) : null;
  const netMargin = revenue && netProfit !== null && revenue !== 0 ? (netProfit / revenue) * 100 : null;
  const roe = equityVal && netProfit !== null && equityVal !== 0 ? (netProfit / equityVal) * 100 : null;
  const roce = ebit !== null && totalAssets !== null && currentLiab !== null && (totalAssets - currentLiab) !== 0
    ? (ebit / (totalAssets - currentLiab)) * 100 : null;
  const currentRatio = currentAssets !== null && currentLiab && currentLiab !== 0
    ? currentAssets / currentLiab : null;
  const eps = netProfit !== null && sharesOutstanding && sharesOutstanding !== 0
    ? netProfit / sharesOutstanding : null;

  return {
    ticker,
    year,
    period,
    source: 'xlsx',
    report_type: reportType,
    non_current_assets: bilanca.non_current_assets as number | null,
    intangible_assets: bilanca.intangible_assets as number | null,
    tangible_assets: bilanca.tangible_assets as number | null,
    current_assets: currentAssets,
    inventories: bilanca.inventories as number | null,
    receivables: bilanca.receivables as number | null,
    current_financial_assets: bilanca.current_financial_assets as number | null,
    cash: bilanca.cash as number | null,
    total_assets: totalAssets,
    share_capital: bilanca.share_capital as number | null,
    retained_earnings: bilanca.retained_earnings as number | null,
    equity: equityVal,
    provisions: bilanca.provisions as number | null,
    long_term_liabilities: bilanca.long_term_liabilities as number | null,
    current_liabilities: currentLiab,
    revenue,
    other_operating_income: rdg.other_operating_income as number | null,
    material_costs: rdg.material_costs as number | null,
    personnel_costs: rdg.personnel_costs as number | null,
    depreciation,
    operating_expenses: opExpenses,
    operating_profit: ebit,
    financial_income: rdg.financial_income as number | null,
    financial_expenses: rdg.financial_expenses as number | null,
    profit_before_tax: rdg.profit_before_tax as number | null,
    income_tax: rdg.income_tax as number | null,
    net_profit: netProfit,
    operating_cash_flow: ocf,
    investing_cash_flow: ntd.investing_cash_flow as number | null,
    capex: capexVal !== null ? Math.abs(capexVal) : null,
    financing_cash_flow: ntd.financing_cash_flow as number | null,
    dividends_paid: ntd.dividends_paid as number | null,
    ebit,
    ebitda,
    free_cash_flow: fcf,
    net_margin: netMargin,
    roe,
    roce,
    current_ratio: currentRatio,
    eps,
  };
}

/**
 * De-cumulate flow fields: standalone = cumulative - previousCumulative.
 * Balance sheet fields are left as-is (point-in-time snapshots).
 */
function deCumulateFlow(
  cumulative: Record<string, number | null>,
  previousCumulative: Record<string, number | null>,
): Record<string, number | null> {
  const result = { ...cumulative };
  for (const field of FLOW_FIELDS) {
    const curr = cumulative[field];
    const prev = previousCumulative[field];
    if (curr !== null && prev !== null) {
      result[field] = curr - prev;
    }
  }
  return result;
}

export interface QuarterUrl {
  quarter: 'Q1' | 'Q2' | 'Q3';
  url: string;
}

/**
 * Scrape quarterly TFI-POD reports for a single year and produce standalone quarter data.
 *
 * @param quarterUrls - Q1, Q2, Q3 cumulative report URLs (sorted by quarter)
 * @param fyData - Full-year (FY) data for this year (used to compute Q4 = FY - Q3_cum)
 * @param ticker - Stock ticker
 * @param reportType - e.g. 'TFI-POD'
 * @param sharesOutstanding - For EPS calculation
 * @returns Array of standalone quarterly XlsxFinancialData records (Q1-Q4)
 */
export async function scrapeQuarterlyXlsx(
  quarterUrls: QuarterUrl[],
  fyData: XlsxFinancialData,
  ticker: string,
  reportType: string,
  sharesOutstanding: number | null,
): Promise<XlsxFinancialData[]> {
  const results: XlsxFinancialData[] = [];

  // Extract cumulative data from each quarterly report
  const cumulativeData: Record<string, {
    bilanca: Record<string, number | null>;
    rdg: Record<string, number | null>;
    ntd: Record<string, number | null>;
  }> = {};

  for (const { quarter, url } of quarterUrls) {
    const raw = await extractRawFromXlsx(url, ticker, reportType);
    if (!raw) {
      console.error(`[xlsx-q] Failed to extract ${quarter} from ${url}`);
      continue;
    }
    cumulativeData[quarter] = { bilanca: raw.bilanca, rdg: raw.rdg, ntd: raw.ntd };
    console.log(`[xlsx-q] Extracted cumulative ${quarter} ${raw.year}`);
  }

  // Q1: standalone = cumulative (no subtraction needed)
  if (cumulativeData['Q1']) {
    const { bilanca, rdg, ntd } = cumulativeData['Q1'];
    results.push(buildFinancialRecord(ticker, fyData.year, 'Q1', reportType, bilanca, rdg, ntd, sharesOutstanding));
    console.log(`[xlsx-q] Q1 standalone OK`);
  }

  // Q2: standalone = Q2_cum - Q1_cum
  if (cumulativeData['Q2'] && cumulativeData['Q1']) {
    const { bilanca } = cumulativeData['Q2'];
    const rdg = deCumulateFlow(cumulativeData['Q2'].rdg, cumulativeData['Q1'].rdg);
    const ntd = deCumulateFlow(cumulativeData['Q2'].ntd, cumulativeData['Q1'].ntd);
    results.push(buildFinancialRecord(ticker, fyData.year, 'Q2', reportType, bilanca, rdg, ntd, sharesOutstanding));
    console.log(`[xlsx-q] Q2 standalone OK`);
  }

  // Q3: standalone = Q3_cum - Q2_cum
  if (cumulativeData['Q3'] && cumulativeData['Q2']) {
    const { bilanca } = cumulativeData['Q3'];
    const rdg = deCumulateFlow(cumulativeData['Q3'].rdg, cumulativeData['Q2'].rdg);
    const ntd = deCumulateFlow(cumulativeData['Q3'].ntd, cumulativeData['Q2'].ntd);
    results.push(buildFinancialRecord(ticker, fyData.year, 'Q3', reportType, bilanca, rdg, ntd, sharesOutstanding));
    console.log(`[xlsx-q] Q3 standalone OK`);
  }

  // Q4: standalone = FY - Q3_cum (use fyData for FY values)
  if (cumulativeData['Q3']) {
    const q3cum = cumulativeData['Q3'];
    // Build FY flow fields from fyData
    const fyRdg: Record<string, number | null> = {};
    const fyNtd: Record<string, number | null> = {};
    for (const field of FLOW_FIELDS) {
      const val = (fyData as unknown as Record<string, unknown>)[field];
      // Classify into rdg or ntd based on field name
      if (['operating_cash_flow', 'investing_cash_flow', 'capex', 'financing_cash_flow', 'dividends_paid'].includes(field)) {
        fyNtd[field] = typeof val === 'number' ? val : null;
      } else {
        fyRdg[field] = typeof val === 'number' ? val : null;
      }
    }
    // fyData.net_profit already stores parent's share (our fixed value).
    // Bridge it to net_profit_parent so Q4 de-cumulation subtracts the right baseline.
    fyRdg['net_profit_parent'] = fyRdg['net_profit'];

    // For capex: fyData stores absolute value but cumulative may be signed — handle both
    const bilanca: Record<string, number | null> = {};
    const bilancaFields = [
      'non_current_assets', 'intangible_assets', 'tangible_assets', 'current_assets',
      'inventories', 'receivables', 'current_financial_assets', 'cash', 'total_assets',
      'share_capital', 'retained_earnings', 'equity', 'provisions',
      'long_term_liabilities', 'current_liabilities',
    ];
    for (const field of bilancaFields) {
      const val = (fyData as unknown as Record<string, unknown>)[field];
      bilanca[field] = typeof val === 'number' ? val : null;
    }

    const rdg = deCumulateFlow(fyRdg, q3cum.rdg);
    const ntd = deCumulateFlow(fyNtd, q3cum.ntd);
    results.push(buildFinancialRecord(ticker, fyData.year, 'Q4', reportType, bilanca, rdg, ntd, sharesOutstanding));
    console.log(`[xlsx-q] Q4 standalone OK (FY - Q3_cum)`);
  }

  return results;
}
