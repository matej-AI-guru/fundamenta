import type { Stock } from './supabase';

export const SCORE_COMPONENTS: { key: keyof Stock; weight: number; higherIsBetter: boolean }[] = [
  { key: 'roce',           weight: 0.25, higherIsBetter: true  },
  { key: 'pe_ratio',       weight: 0.20, higherIsBetter: false },
  { key: 'ev_ebitda',      weight: 0.15, higherIsBetter: false },
  { key: 'net_margin',     weight: 0.15, higherIsBetter: true  },
  { key: 'dividend_yield', weight: 0.10, higherIsBetter: true  },
];

export const SCORE_TIP =
  'Kompozitni score (0–10) relativni percentilni ranking unutar prikazanih dionica.\n' +
  'Komponente: ROCE 29% · P/E inv. 24% · EV/EBITDA inv. 18% · Neto marža 18% · Div. prinos 12%.\n' +
  'Outlieri klipani na 5.–95. percentil. Nedostajući podaci → renormalizirane težine.\n' +
  'Rast prihoda (YoY) izostavljen (nema podataka o prethodnoj godini).';

// Compute percentile-ranked scores for all stocks.
// Returns a Map<ticker, score | null>.
export function computeScores(stocks: Stock[]): Map<string, number | null> {
  const compMaps = new Map<keyof Stock, Map<string, number>>();

  for (const comp of SCORE_COMPONENTS) {
    const valid = stocks.filter(s => {
      const v = s[comp.key] as number | null;
      if (v === null || v === undefined || !isFinite(v as number)) return false;
      if (comp.key === 'pe_ratio' && (v as number) <= 0) return false;
      return true;
    });
    if (valid.length < 2) continue;

    const vals = valid.map(s => s[comp.key] as number);
    const asc = [...vals].sort((a, b) => a - b);
    const lo = asc[Math.floor(0.05 * (asc.length - 1))];
    const hi = asc[Math.floor(0.95 * (asc.length - 1))];
    const clipped = vals.map(v => Math.max(lo, Math.min(hi, v)));
    const clippedAsc = [...clipped].sort((a, b) => a - b);

    const rankMap = new Map<string, number>();
    for (let i = 0; i < valid.length; i++) {
      const v = clipped[i];
      const below = clippedAsc.filter(x => x < v).length;
      const equal = clippedAsc.filter(x => x === v).length;
      const pct = (below + equal / 2) / clippedAsc.length;
      rankMap.set(valid[i].ticker, (comp.higherIsBetter ? pct : 1 - pct) * 10);
    }
    compMaps.set(comp.key, rankMap);
  }

  const result = new Map<string, number | null>();
  for (const stock of stocks) {
    let weightedSum = 0;
    let totalWeight = 0;
    for (const comp of SCORE_COMPONENTS) {
      const m = compMaps.get(comp.key);
      if (!m) continue;
      const s = m.get(stock.ticker);
      if (s === undefined) continue;
      weightedSum += s * comp.weight;
      totalWeight += comp.weight;
    }
    result.set(stock.ticker, totalWeight > 0 ? weightedSum / totalWeight : null);
  }
  return result;
}

// Single-stock score relative to all stocks.
export function computeScore(ticker: string, allStocks: Stock[]): number | null {
  return computeScores(allStocks).get(ticker) ?? null;
}

// Sub-scores for detail page (valuation, profitability, financial health).
const VALUATION_KEYS: (keyof Stock)[] = ['pe_ratio', 'pb_ratio', 'ev_ebitda'];
const PROFITABILITY_KEYS: (keyof Stock)[] = ['roce', 'net_margin', 'roe'];
const HEALTH_KEYS: (keyof Stock)[] = ['current_ratio', 'free_cash_flow'];

function groupPercentile(
  stock: Stock,
  allStocks: Stock[],
  keys: (keyof Stock)[],
  higherIsBetter: boolean[]
): number | null {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const better = higherIsBetter[i];
    const val = stock[key] as number | null;
    if (val === null || !isFinite(val)) continue;
    if (key === 'pe_ratio' && val <= 0) continue;
    const allVals = allStocks
      .map(s => s[key] as number | null)
      .filter((v): v is number => v !== null && isFinite(v));
    if (allVals.length < 2) continue;
    const asc = [...allVals].sort((a, b) => a - b);
    const below = asc.filter(x => x < val).length;
    const equal = asc.filter(x => x === val).length;
    const pct = (below + equal / 2) / asc.length;
    sum += (better ? pct : 1 - pct) * 10;
    count++;
  }
  return count > 0 ? sum / count : null;
}

export function computeDetailedScore(ticker: string, allStocks: Stock[]): {
  overall: number | null;
  valuation: number | null;
  profitability: number | null;
  health: number | null;
} {
  const stock = allStocks.find(s => s.ticker === ticker);
  if (!stock) return { overall: null, valuation: null, profitability: null, health: null };
  return {
    overall:       computeScore(ticker, allStocks),
    valuation:     groupPercentile(stock, allStocks, VALUATION_KEYS,     [false, false, false]),
    profitability: groupPercentile(stock, allStocks, PROFITABILITY_KEYS, [true,  true,  true ]),
    health:        groupPercentile(stock, allStocks, HEALTH_KEYS,        [true,  true        ]),
  };
}

export function scoreColor(v: number): string {
  if (v >= 7) return 'text-emerald-600';
  if (v >= 4) return 'text-amber-500';
  return 'text-red-500';
}
