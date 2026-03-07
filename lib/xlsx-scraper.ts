import * as XLSX from 'xlsx';

const HRK_TO_EUR = 7.5345;

// Extended financial data from XLSX TFI-POD/GFI-POD reports
export interface XlsxFinancialData {
  ticker: string;
  year: number;
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

// Bilanca AOP numbers are the same across all years
const BILANCA_AOPS: AopMapping[] = [
  { aop: 2,   field: 'non_current_assets' },
  { aop: 3,   field: 'intangible_assets' },
  { aop: 10,  field: 'tangible_assets' },
  { aop: 37,  field: 'current_assets' },
  { aop: 38,  field: 'inventories' },
  { aop: 46,  field: 'receivables' },
  { aop: 53,  field: 'current_financial_assets' },
  { aop: 63,  field: 'cash' },
  { aop: 65,  field: 'total_assets' },
  { aop: 67,  field: 'equity' },
  { aop: 68,  field: 'share_capital' },
  { aop: 83,  field: 'retained_earnings' },
  { aop: 90,  field: 'provisions' },
  { aop: 97,  field: 'long_term_liabilities' },
  { aop: 109, field: 'current_liabilities' },
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
  { aop: 59,  field: 'net_profit' },
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
  { aop: 183, field: 'net_profit' },
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

  console.log(`[xlsx] Year: ${year}, Currency: ${currency}, AOP scheme: ${aopScheme}`);

  const results: XlsxFinancialData[] = [];

  // Extract for both years: current (yearOffset=0) and previous (yearOffset=1)
  for (const yearOffset of [0, 1]) {
    const yr = yearOffset === 0 ? year : year - 1;

    // Bilanca: AOP in col 6, prev=col 7, curr=col 8
    const bilancaValueCol = yearOffset === 0 ? 8 : 7;
    let bilanca = extractAopValues(bilancaRows, BILANCA_AOPS, 6, bilancaValueCol);

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
    const netProfit = rdg.net_profit as number | null;
    const equityVal = bilanca.equity as number | null;
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
