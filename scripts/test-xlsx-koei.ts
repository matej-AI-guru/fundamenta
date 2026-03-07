/**
 * Test script: Parse KOEI XLSX and compare with mojedionice.com scraper data.
 * Usage: npx tsx scripts/test-xlsx-koei.ts
 */
import { scrapeXlsx } from '../lib/xlsx-scraper';
import { fetchStockData } from '../lib/scraper';

const KOEI_XLSX_URL =
  'https://koncar.hr/sites/default/files/dokumenti/financijski-izvjestaji/2026-02/Grupa_KON%C4%8CAR_TFI-POD_31%2012%202025_HR.xlsx';

function fmt(v: number | null): string {
  if (v === null) return 'null';
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toFixed(2);
}

function pctDiff(a: number, b: number): string {
  if (a === 0 && b === 0) return '0%';
  if (a === 0) return 'N/A';
  const diff = ((b - a) / Math.abs(a)) * 100;
  return (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
}

async function main() {
  console.log('=== Step 1: Parse KOEI XLSX ===\n');
  const xlsxData = await scrapeXlsx(KOEI_XLSX_URL, 'KOEI');

  if (xlsxData.length === 0) {
    console.error('Failed to parse XLSX');
    return;
  }

  for (const d of xlsxData) {
    console.log(`\n--- Year ${d.year} ---`);
    console.log('BILANCA:');
    console.log(`  Dugotrajna imovina:      ${fmt(d.non_current_assets)}`);
    console.log(`  Nematerijalna imovina:    ${fmt(d.intangible_assets)}`);
    console.log(`  Materijalna imovina:      ${fmt(d.tangible_assets)}`);
    console.log(`  Kratkotrajna imovina:     ${fmt(d.current_assets)}`);
    console.log(`  Zalihe:                   ${fmt(d.inventories)}`);
    console.log(`  Potraživanja:             ${fmt(d.receivables)}`);
    console.log(`  Kratk. fin. imovina:      ${fmt(d.current_financial_assets)}`);
    console.log(`  Novac:                    ${fmt(d.cash)}`);
    console.log(`  Ukupno aktiva:            ${fmt(d.total_assets)}`);
    console.log(`  Temeljni kapital:         ${fmt(d.share_capital)}`);
    console.log(`  Zadržana dobit:           ${fmt(d.retained_earnings)}`);
    console.log(`  Kapital i rezerve:        ${fmt(d.equity)}`);
    console.log(`  Rezerviranja:             ${fmt(d.provisions)}`);
    console.log(`  Dugoročne obveze:         ${fmt(d.long_term_liabilities)}`);
    console.log(`  Kratkoročne obveze:       ${fmt(d.current_liabilities)}`);

    console.log('RDG:');
    console.log(`  Poslovni prihodi:         ${fmt(d.revenue)}`);
    console.log(`  Ostali posl. prihodi:     ${fmt(d.other_operating_income)}`);
    console.log(`  Materijalni troškovi:     ${fmt(d.material_costs)}`);
    console.log(`  Troškovi osoblja:         ${fmt(d.personnel_costs)}`);
    console.log(`  Amortizacija:             ${fmt(d.depreciation)}`);
    console.log(`  Poslovni rashodi:         ${fmt(d.operating_expenses)}`);
    console.log(`  EBIT:                     ${fmt(d.ebit)}`);
    console.log(`  Financijski prihodi:      ${fmt(d.financial_income)}`);
    console.log(`  Financijski rashodi:      ${fmt(d.financial_expenses)}`);
    console.log(`  Dobit prije poreza:       ${fmt(d.profit_before_tax)}`);
    console.log(`  Porez na dobit:           ${fmt(d.income_tax)}`);
    console.log(`  Neto dobit:               ${fmt(d.net_profit)}`);
    console.log(`  EBITDA:                   ${fmt(d.ebitda)}`);

    console.log('NOVČANI TOK:');
    console.log(`  Operativni CF:            ${fmt(d.operating_cash_flow)}`);
    console.log(`  Investicijski CF:         ${fmt(d.investing_cash_flow)}`);
    console.log(`  CapEx:                    ${fmt(d.capex)}`);
    console.log(`  Financijski CF:           ${fmt(d.financing_cash_flow)}`);
    console.log(`  Dividende isplaćene:      ${fmt(d.dividends_paid)}`);
    console.log(`  FCF:                      ${fmt(d.free_cash_flow)}`);

    console.log('OMJERI:');
    console.log(`  Neto marža:               ${d.net_margin?.toFixed(2) ?? 'null'}%`);
    console.log(`  ROE:                      ${d.roe?.toFixed(2) ?? 'null'}%`);
    console.log(`  ROCE:                     ${d.roce?.toFixed(2) ?? 'null'}%`);
    console.log(`  Current ratio:            ${d.current_ratio?.toFixed(2) ?? 'null'}`);
  }

  // Step 2: Fetch mojedionice data for comparison
  console.log('\n\n=== Step 2: Fetch KOEI from mojedionice.com ===\n');
  const mdData = await fetchStockData('KOEI');

  if (!mdData) {
    console.error('Failed to fetch from mojedionice.com');
    return;
  }

  // Compare current year data
  const xlsxCurr = xlsxData[0]; // current year (2025)
  const xlsxPrev = xlsxData[1]; // previous year (2024)

  // mojedionice scraper returns "current" year data and _yearlyData
  const mdYearly = mdData._yearlyData ?? [];
  const mdCurrYear = mdYearly[0];
  const mdPrevYear = mdYearly[1];

  console.log(`mojedionice current year: ${mdCurrYear?.year ?? 'N/A'}`);
  console.log(`mojedionice prev year:    ${mdPrevYear?.year ?? 'N/A'}`);
  console.log(`XLSX current year:        ${xlsxCurr.year}`);
  console.log(`XLSX prev year:           ${xlsxPrev.year}`);

  // Pick matching years for comparison
  const xlsxCompare = mdCurrYear?.year === xlsxCurr.year ? xlsxCurr
    : mdCurrYear?.year === xlsxPrev.year ? xlsxPrev : null;

  if (!xlsxCompare || !mdCurrYear) {
    console.log('\nNo matching year for comparison.');
    console.log('Comparing mojedionice "stocks" data with XLSX current year anyway:\n');

    // Compare with the main StockData fields
    type CompareRow = [string, number | null, number | null];
    const comparisons: CompareRow[] = [
      ['Revenue',            mdData.revenue,             xlsxCurr.revenue],
      ['Net Profit',         mdData.net_profit,           xlsxCurr.net_profit],
      ['EBIT',               mdData.ebit,                 xlsxCurr.ebit],
      ['EBITDA',             mdData.ebitda,               xlsxCurr.ebitda],
      ['Depreciation',       mdData.depreciation,         xlsxCurr.depreciation],
      ['Total Assets',       mdData.total_assets,         xlsxCurr.total_assets],
      ['Equity',             mdData.equity,               xlsxCurr.equity],
      ['Cash',               mdData.cash,                 xlsxCurr.cash],
      ['Current Assets',     mdData.current_assets,       xlsxCurr.current_assets],
      ['Current Fin Assets', mdData.current_financial_assets, xlsxCurr.current_financial_assets],
      ['Long-term Liab',     mdData.long_term_liabilities, xlsxCurr.long_term_liabilities],
      ['Current Liab',       mdData.current_liabilities,  xlsxCurr.current_liabilities],
      ['Operating CF',       mdData.operating_cash_flow,  xlsxCurr.operating_cash_flow],
      ['CapEx',              mdData.capex,                xlsxCurr.capex],
      ['FCF',                mdData.free_cash_flow,       xlsxCurr.free_cash_flow],
    ];

    console.log('Field'.padEnd(20) + 'MojeDionice'.padStart(15) + 'XLSX'.padStart(15) + 'Diff'.padStart(10));
    console.log('-'.repeat(60));
    for (const [label, mdVal, xlsxVal] of comparisons) {
      const diff = mdVal !== null && xlsxVal !== null ? pctDiff(mdVal, xlsxVal) : '-';
      console.log(
        label.padEnd(20) +
        fmt(mdVal).padStart(15) +
        fmt(xlsxVal).padStart(15) +
        diff.padStart(10)
      );
    }
    return;
  }

  // Matching year found — compare yearly data
  console.log(`\nComparing year ${mdCurrYear.year}:\n`);

  type CompareRow = [string, number | null, number | null];
  const comparisons: CompareRow[] = [
    ['Revenue',            mdCurrYear.revenue,             xlsxCompare.revenue],
    ['Net Profit',         mdCurrYear.net_profit,           xlsxCompare.net_profit],
    ['EBIT',               mdCurrYear.ebit,                 xlsxCompare.ebit],
    ['EBITDA',             mdCurrYear.ebitda,               xlsxCompare.ebitda],
    ['Depreciation',       mdCurrYear.depreciation,         xlsxCompare.depreciation],
    ['Total Assets',       mdCurrYear.total_assets,         xlsxCompare.total_assets],
    ['Equity',             mdCurrYear.equity,               xlsxCompare.equity],
    ['Cash',               mdCurrYear.cash,                 xlsxCompare.cash],
    ['Current Assets',     mdCurrYear.current_assets,       xlsxCompare.current_assets],
    ['Current Fin Assets', mdCurrYear.current_financial_assets, xlsxCompare.current_financial_assets],
    ['Long-term Liab',     mdCurrYear.long_term_liabilities, xlsxCompare.long_term_liabilities],
    ['Current Liab',       mdCurrYear.current_liabilities,  xlsxCompare.current_liabilities],
    ['Operating CF',       mdCurrYear.operating_cash_flow,  xlsxCompare.operating_cash_flow],
    ['CapEx',              mdCurrYear.capex,                xlsxCompare.capex],
    ['FCF',                mdCurrYear.free_cash_flow,       xlsxCompare.free_cash_flow],
  ];

  console.log('Field'.padEnd(20) + 'MojeDionice'.padStart(15) + 'XLSX'.padStart(15) + 'Diff'.padStart(10));
  console.log('-'.repeat(60));
  for (const [label, mdVal, xlsxVal] of comparisons) {
    const diff = mdVal !== null && xlsxVal !== null ? pctDiff(mdVal, xlsxVal) : '-';
    console.log(
      label.padEnd(20) +
      fmt(mdVal).padStart(15) +
      fmt(xlsxVal).padStart(15) +
      diff.padStart(10)
    );
  }
}

main().catch(console.error);
