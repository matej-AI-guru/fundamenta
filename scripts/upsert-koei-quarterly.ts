import { readFileSync } from 'fs';

// Load .env.local manually (no dotenv dependency)
const envContent = readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

import { scrapeQuarterlyXlsx, QuarterUrl } from '../lib/xlsx-scraper';
import { getSupabaseAdmin } from '../lib/supabase';

const SHARES_OUTSTANDING = 2572119;
const BASE = 'https://koncar.hr/sites/default/files/dokumenti/financijski-izvjestaji';

// All consolidated quarterly TFI-POD reports for Grupa KONČAR, grouped by year.
// Each year has Q1 (Jan-Mar), Q2 (Jan-Jun), Q3 (Jan-Sep) cumulative reports.
// Q4 is computed as FY - Q3_cumulative using the annual (FY) data from the database.
const QUARTERLY_URLS: Record<number, QuarterUrl[]> = {
  2019: [
    { quarter: 'Q1', url: BASE + '/2023-12/KONCAR-Grupa-1-3-2019-TFI-POD.xlsx' },
    { quarter: 'Q2', url: BASE + '/2023-12/KONCAR-Grupa-TFI-POD-300619.xlsx' },
    { quarter: 'Q3', url: BASE + '/2023-12/KONCAR-Grupa-1-9-2019-TFI-POD.xlsx' },
  ],
  2020: [
    { quarter: 'Q1', url: BASE + '/2023-12/KONCAR-TFI-POD-KONCAR-Grupa-1-3-2020.xlsx' },
    { quarter: 'Q2', url: BASE + '/2023-12/KONCAR-Grupa-TFI-POD-sijecanj-lipanj-2020.xlsx' },
    { quarter: 'Q3', url: BASE + '/2023-12/KONCAR-Grupa-TFI-POD-1-9-2020.xlsx' },
  ],
  2021: [
    { quarter: 'Q1', url: BASE + '/2023-12/KONCAR-Grupa-sijecanj-ozujak-2021-TFI-POD.xlsx' },
    { quarter: 'Q2', url: BASE + '/2023-12/2907-TFI-POD-Grupa-Koncar.xlsx' },
    { quarter: 'Q3', url: BASE + '/2023-12/TFI-POD-Grupa-Koncar-30-9-2021-HANFA-.xlsx' },
  ],
  2022: [
    { quarter: 'Q1', url: BASE + '/2023-12/TFI-POD-31-3-2022-grupa-Koncar-1.xlsx' },
    { quarter: 'Q2', url: BASE + '/2023-12/TFI-POD-30-6-2022-grupa-Koncar.xlsx' },
    // Q3 (Jan-Sep 2022) not available on koncar.hr
  ],
  2023: [
    { quarter: 'Q1', url: BASE + '/2023-12/Tromjesecni-financijski-izvjestaj-poduzetnika-za-KONCAR-Grupu-za-razdoblje-sijecanj-ozujak-2023.-TFI-POD.xlsx' },
    { quarter: 'Q2', url: BASE + '/2023-12/Tromjesecni-financijski-izvjestaj-poduzetnika-za-KONCAR-Grupu-za-razdoblje-sijecanj-lipanj-2023.-TFI-POD.xlsx' },
    { quarter: 'Q3', url: BASE + '/2023-12/TFI-POD-Grupa-Koncar-30-9-2023-v2.xlsx' },
  ],
  2024: [
    { quarter: 'Q1', url: BASE + '/2024-04/Konsolidirani%20nerevidirani%20tromjese%C4%8Dni%20financijski%20izvje%C5%A1taj%20poduzetnika%20za%20Grupu%20KON%C4%8CAR%20za%20razdoblje%20sije%C4%8Danj%20-%20o%C5%BEujak%202024.%20%28TFI_POD%29.xlsx' },
    { quarter: 'Q2', url: BASE + '/2024-07/Konsolidirani%20nerevidirani%20financijski%20izvje%C5%A1taj%20poduzetnika%20za%20Grupu%20KON%C4%8CAR%20za%20razdoblje%20sije%C4%8Danj%20-%20lipanj%202024.%20%28TFI_POD%29.xlsx' },
    { quarter: 'Q3', url: BASE + '/2024-10/Konsolidirani%20nerevidirani%20financijski%20izvje%C5%A1taj%20poduzetnika%20za%20Grupu%20KON%C4%8CAR%20za%20razdoblje%20sije%C4%8Danj%20-%20rujan%202024.%20%28TFI%20POD%29.xlsx' },
  ],
  2025: [
    { quarter: 'Q1', url: BASE + '/2025-04/TFI_POD%20Grupa%20Kon%C4%8Dar%2031%203%202025.xlsx' },
    { quarter: 'Q2', url: BASE + '/2025-07/TFI_POD%20Grupa%20Kon%C4%8Dar%2030%206%202025%20v2.xlsx' },
    { quarter: 'Q3', url: BASE + '/2025-10/Grupa_KON%C4%8CAR_TFI-POD_Q32025_HR.xlsx' },
  ],
};

async function main() {
  const sb = getSupabaseAdmin();

  // Fetch all FY data for KOEI from DB (needed for Q4 = FY - Q3_cum)
  const { data: fyRows, error: fyErr } = await sb
    .from('stock_financials')
    .select('*')
    .eq('ticker', 'KOEI')
    .eq('period', 'FY')
    .order('year', { ascending: true });

  if (fyErr || !fyRows) {
    console.error('Failed to fetch FY data:', fyErr);
    return;
  }

  const fyByYear: Record<number, typeof fyRows[0]> = {};
  for (const row of fyRows) {
    fyByYear[row.year] = row;
  }

  console.log(`Loaded FY data for years: ${Object.keys(fyByYear).join(', ')}\n`);

  const allQuarterlyData: any[] = [];

  // Process each year
  for (const [yearStr, urls] of Object.entries(QUARTERLY_URLS)) {
    const year = parseInt(yearStr);
    const fyData = fyByYear[year];

    if (!fyData) {
      console.error(`No FY data for ${year} — skipping quarterly\n`);
      continue;
    }

    console.log(`\n=== ${year} (${urls.length} quarterly reports) ===`);

    try {
      const quarters = await scrapeQuarterlyXlsx(urls, fyData, 'KOEI', 'TFI-POD', SHARES_OUTSTANDING);
      console.log(`  → Got ${quarters.length} standalone quarters: ${quarters.map(q => q.period).join(', ')}`);

      // Validation: Q1+Q2+Q3+Q4 revenue ≈ FY revenue
      const qRevSum = quarters.reduce((sum, q) => sum + (q.revenue ?? 0), 0);
      const fyRev = fyData.revenue ?? 0;
      const diff = Math.abs(qRevSum - fyRev);
      const pctDiff = fyRev !== 0 ? ((diff / fyRev) * 100).toFixed(1) : 'N/A';
      console.log(`  → Revenue validation: Q_sum=${fmt(qRevSum)} FY=${fmt(fyRev)} diff=${fmt(diff)} (${pctDiff}%)`);

      allQuarterlyData.push(...quarters);
    } catch (err) {
      console.error(`  → Error: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\n=== Total: ${allQuarterlyData.length} quarterly records ===\n`);

  // Print summary
  for (const d of allQuarterlyData) {
    console.log(`${d.year} ${d.period}: revenue=${fmt(d.revenue)} net_profit=${fmt(d.net_profit)} total_assets=${fmt(d.total_assets)}`);
  }

  // Upsert to Supabase
  if (allQuarterlyData.length > 0) {
    const { error } = await sb
      .from('stock_financials')
      .upsert(allQuarterlyData, { onConflict: 'ticker,year,period' });

    if (error) {
      console.error('\nUpsert error:', error);
    } else {
      console.log(`\nUpsert OK! ${allQuarterlyData.length} quarterly rows for KOEI.`);
    }
  }

  // Verify
  const { data: rows, error: readErr } = await sb
    .from('stock_financials')
    .select('ticker, year, period, revenue, net_profit, total_assets')
    .eq('ticker', 'KOEI')
    .neq('period', 'FY')
    .order('year', { ascending: true })
    .order('period', { ascending: true });

  if (readErr) {
    console.error('Read error:', readErr);
  } else {
    console.log('\nKOEI quarterly rows in DB:');
    for (const r of rows!) {
      console.log(`  ${r.year} ${r.period}: revenue=${fmt(r.revenue)} net_profit=${fmt(r.net_profit)} total_assets=${fmt(r.total_assets)}`);
    }
  }
}

function fmt(v: number | null): string {
  if (v === null) return 'null';
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(0) + 'K';
  return v.toFixed(0);
}

main().catch(console.error);
