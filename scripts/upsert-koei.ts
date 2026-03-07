import { readFileSync } from 'fs';

// Load .env.local manually (no dotenv dependency)
const envContent = readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

import { scrapeXlsx } from '../lib/xlsx-scraper';
import { getSupabaseAdmin } from '../lib/supabase';

const KOEI_URL = 'https://koncar.hr/sites/default/files/dokumenti/financijski-izvjestaji/2026-02/Grupa_KON%C4%8CAR_TFI-POD_31%2012%202025_HR.xlsx';

async function main() {
  const data = await scrapeXlsx(KOEI_URL, 'KOEI', 'TFI-POD', 2572119);
  console.log('Parsed', data.length, 'years:', data.map(d => d.year));

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('stock_financials')
    .upsert(data, { onConflict: 'ticker,year' });

  if (error) {
    console.error('Upsert error:', error);
  } else {
    console.log('Upsert OK!');
  }

  // Verify
  const { data: rows, error: readErr } = await sb
    .from('stock_financials')
    .select('ticker, year, revenue, net_profit, total_assets, equity, source, non_current_assets, inventories, personnel_costs, profit_before_tax, investing_cash_flow, dividends_paid')
    .eq('ticker', 'KOEI')
    .order('year', { ascending: false });

  if (readErr) console.error('Read error:', readErr);
  else {
    console.log('\nKOEI rows in DB:');
    for (const r of rows!) console.log(JSON.stringify(r));
  }
}
main().catch(console.error);
