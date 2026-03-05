// One-time cleanup script — run with: node scripts/cleanup.mjs
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(join(__dirname, '..', '.env.local'), 'utf-8');
const env = Object.fromEntries(
  envContent.split('\n')
    .map(l => l.match(/^([^=]+)=(.*)$/))
    .filter(Boolean)
    .map(m => [m[1].trim(), m[2].trim()])
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const res = await fetch(`${URL}/rest/v1/stocks?ticker=eq.HEFA`, {
  method: 'DELETE',
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'return=minimal' },
});

console.log(res.ok ? 'HEFA deleted ✓' : `Error ${res.status}: ${await res.text()}`);
