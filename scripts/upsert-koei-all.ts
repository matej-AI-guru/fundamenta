import { readFileSync } from 'fs';

// Load .env.local manually (no dotenv dependency)
const envContent = readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

import { scrapeXlsx, XlsxFinancialData } from '../lib/xlsx-scraper';
import { getSupabaseAdmin } from '../lib/supabase';

const SHARES_OUTSTANDING = 2572119;
const BASE = 'https://koncar.hr';

// All consolidated annual TFI-POD reports, ordered from oldest to newest.
// Later reports overwrite earlier ones for overlapping years (newer data preferred).
const KOEI_TFI_URLS = [
  // 2019 TFI-POD → years 2019, 2018
  BASE + '/sites/default/files/dokumenti/financijski-izvjestaji/2023-12/KONCAR-Grupa-TFI-POD-1-12-2019.xlsx',
  // 2020 TFI-POD → years 2020, 2019
  BASE + '/sites/default/files/dokumenti/financijski-izvjestaji/2023-12/KONCAR-Grupa-sijecanj-prosinac-2020-nerevidirano-TFI-POD.xlsx',
  // 2021 TFI-POD → years 2021, 2020
  BASE + '/sites/default/files/dokumenti/financijski-izvjestaji/2023-12/TFI-POD-Grupa-Koncar-31-12-2021-HANFA-zadnje.xlsx',
  // 2022 TFI-POD → years 2022, 2021
  BASE + '/sites/default/files/dokumenti/financijski-izvjestaji/2023-12/Tromjesecni-financijski-izvjestaj-poduzetnika-za-Grupu-KONCAR-za-razdoblje-sijecanj-prosinac-2022..xlsx',
  // 2023 TFI-POD → years 2023, 2022
  BASE + '/sites/default/files/dokumenti/financijski-izvjestaji/2024-02/Konsolidirani%20nerevidirani%20financijski%20izvje%C5%A1taj%20poduzetnika%20za%20Grupu%20KON%C4%8CAR%20za%20razdoblje%20sije%C4%8Danj%20-%20prosinac%202023.%20%28TFI-POD%29.xlsx',
  // 2024 TFI-POD → years 2024, 2023
  BASE + '/sites/default/files/dokumenti/financijski-izvjestaji/2025-02/TFI_POD%20Grupa%20Kon%C4%8Dar%2031%2012%202024.xlsx',
  // 2025 TFI-POD → years 2025, 2024
  BASE + '/sites/default/files/dokumenti/financijski-izvjestaji/2026-02/Grupa_KON%C4%8CAR_TFI-POD_31%2012%202025_HR.xlsx',
];

async function main() {
  // Collect all data, later entries override earlier ones for same year
  const byYear: Record<number, XlsxFinancialData> = {};

  for (const url of KOEI_TFI_URLS) {
    try {
      const data = await scrapeXlsx(url, 'KOEI', 'TFI-POD', SHARES_OUTSTANDING);
      for (const d of data) {
        byYear[d.year] = d; // newer report overwrites older for same year
      }
      console.log(`  → Parsed years: ${data.map(d => d.year).join(', ')}`);
    } catch (err) {
      console.error(`  → Error: ${err instanceof Error ? err.message : err}`);
    }
    console.log('');
  }

  const allData = Object.values(byYear).sort((a, b) => a.year - b.year);
  console.log(`\n=== Total: ${allData.length} years (${allData.map(d => d.year).join(', ')}) ===\n`);

  // Print summary
  for (const d of allData) {
    console.log(`${d.year}: revenue=${fmt(d.revenue)} net_profit=${fmt(d.net_profit)} total_assets=${fmt(d.total_assets)} equity=${fmt(d.equity)} ocf=${fmt(d.operating_cash_flow)} fcf=${fmt(d.free_cash_flow)}`);
  }

  // Upsert to Supabase
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('stock_financials')
    .upsert(allData, { onConflict: 'ticker,year,period' });

  if (error) {
    console.error('\nUpsert error:', error);
  } else {
    console.log(`\nUpsert OK! ${allData.length} rows for KOEI.`);
  }

  // Verify
  const { data: rows, error: readErr } = await sb
    .from('stock_financials')
    .select('ticker, year, revenue, net_profit, total_assets, equity, operating_cash_flow, free_cash_flow, source')
    .eq('ticker', 'KOEI')
    .order('year', { ascending: true });

  if (readErr) {
    console.error('Read error:', readErr);
  } else {
    console.log('\nKOEI rows in DB:');
    for (const r of rows!) {
      console.log(`  ${r.year}: revenue=${fmt(r.revenue)} net_profit=${fmt(r.net_profit)} total_assets=${fmt(r.total_assets)} equity=${fmt(r.equity)} ocf=${fmt(r.operating_cash_flow)} fcf=${fmt(r.free_cash_flow)} [${r.source}]`);
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
