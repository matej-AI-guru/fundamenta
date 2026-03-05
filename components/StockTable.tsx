'use client';

import { useState, useMemo, useEffect, type ReactNode } from 'react';
import type { Stock } from '@/lib/supabase';
import CompareModal from './CompareModal';

interface StockTableProps {
  stocks: Stock[];
  isLoading: boolean;
}

type SortKey = keyof Stock | 'score';
type SortDir = 'asc' | 'desc';
type TabId = 'pregled' | 'vrednovanje' | 'profitabilnost' | 'bilanca';

// ---------------------------------------------------------------------------
// ISIN helpers
// ---------------------------------------------------------------------------
function isinCheckDigit(s: string): number {
  const digits: number[] = [];
  for (const ch of s) {
    if (ch >= 'A' && ch <= 'Z') {
      const n = ch.charCodeAt(0) - 55;
      digits.push(Math.floor(n / 10), n % 10);
    } else {
      digits.push(parseInt(ch));
    }
  }
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i];
    if ((digits.length - i) % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

function tickerToZseUrl(ticker: string): string {
  const isPreferred = ticker.endsWith('2');
  const base = isPreferred ? ticker.slice(0, -1) : ticker;
  const padded = base.padEnd(4, '0');
  const shareClass = isPreferred ? 'PA' : 'RA';
  const withoutCheck = `HR${padded}${shareClass}000`;
  return `https://zse.hr/hr/papir/310?isin=${withoutCheck}${isinCheckDigit(withoutCheck)}`;
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------
function fmt(v: number | null, decimals = 2): string {
  if (v === null || v === undefined) return '—';
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(decimals);
}
const fmtPct = (v: number | null) => (v !== null ? `${v.toFixed(2)}%` : '—');
const fmtX = (v: number | null) => (v !== null ? `${v.toFixed(2)}x` : '—');

// ---------------------------------------------------------------------------
// Composite score
// ---------------------------------------------------------------------------
const SCORE_COMPONENTS: { key: keyof Stock; weight: number; higherIsBetter: boolean }[] = [
  { key: 'roce',           weight: 0.25, higherIsBetter: true  },
  { key: 'pe_ratio',       weight: 0.20, higherIsBetter: false },
  { key: 'ev_ebitda',      weight: 0.15, higherIsBetter: false },
  { key: 'net_margin',     weight: 0.15, higherIsBetter: true  },
  { key: 'dividend_yield', weight: 0.10, higherIsBetter: true  },
];

const SCORE_TIP =
  'Kompozitni score (0–10) relativni percentilni ranking unutar prikazanih dionica.\n' +
  'Komponente: ROCE 29% · P/E inv. 24% · EV/EBITDA inv. 18% · Neto marža 18% · Div. prinos 12%.\n' +
  'Outlieri klipani na 5.–95. percentil. Nedostajući podaci → renormalizirane težine.\n' +
  'Rast prihoda (YoY) izostavljen (nema podataka o prethodnoj godini).';

function computeScores(stocks: Stock[]): Map<string, number | null> {
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

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
const TABS: { id: TabId; label: string; columns: string[] }[] = [
  {
    id: 'pregled',
    label: 'Pregled',
    columns: ['ticker', 'score', 'name', 'price', 'market_cap', 'pe_ratio', 'ev_ebitda', 'dividend_yield'],
  },
  {
    id: 'vrednovanje',
    label: 'Valuacija',
    columns: ['ticker', 'score', 'price', 'market_cap', 'buffett_metric', 'buffett_undervalue', 'ev_ebitda', 'pe_ratio', 'pb_ratio'],
  },
  {
    id: 'profitabilnost',
    label: 'Profitabilnost',
    columns: ['ticker', 'net_margin', 'roe', 'roce'],
  },
  {
    id: 'bilanca',
    label: 'Bilanca i RDG',
    columns: ['ticker', 'revenue', 'ebitda', 'eps', 'current_assets', 'current_financial_assets', 'current_liabilities', 'total_assets', 'ebit', 'current_ratio'],
  },
];

// ---------------------------------------------------------------------------
// Mobile sort options
// ---------------------------------------------------------------------------
const SORT_OPTIONS: { label: string; key: SortKey; dir: SortDir }[] = [
  { label: 'Score ↓',          key: 'score',          dir: 'desc' },
  { label: 'Tržišna kap. ↓',  key: 'market_cap',     dir: 'desc' },
  { label: 'P/E ↑',           key: 'pe_ratio',       dir: 'asc'  },
  { label: 'EV/EBITDA ↑',     key: 'ev_ebitda',      dir: 'asc'  },
  { label: 'Neto marža ↓',    key: 'net_margin',     dir: 'desc' },
  { label: 'ROE ↓',           key: 'roe',            dir: 'desc' },
  { label: 'ROCE ↓',          key: 'roce',           dir: 'desc' },
  { label: 'Div. prinos ↓',   key: 'dividend_yield', dir: 'desc' },
  { label: 'Ticker A–Z',      key: 'ticker',         dir: 'asc'  },
];

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------
function getColorClass(key: SortKey, stock: Stock): string {
  if (key === 'net_margin' && stock.net_margin !== null)
    return stock.net_margin > 0 ? 'text-emerald-600' : 'text-red-500';
  if (key === 'roe' && stock.roe !== null)
    return stock.roe > 0 ? 'text-emerald-600' : 'text-red-500';
  return '';
}

function scoreColor(v: number): string {
  if (v >= 7) return 'text-emerald-600';
  if (v >= 4) return 'text-amber-500';
  return 'text-red-500';
}

// ---------------------------------------------------------------------------
// Stock card (mobile)
// ---------------------------------------------------------------------------
interface StockCardProps {
  stock: Stock;
  score: number | null;
  isSelected: boolean;
  isDisabled: boolean;
  onToggle: () => void;
}

function MetricCell({ label, value, colorClass = '' }: { label: string; value: string; colorClass?: string }) {
  return (
    <div>
      <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</div>
      <div className={`text-xs font-medium text-gray-700 ${colorClass}`}>{value}</div>
    </div>
  );
}

function StockCard({ stock, score, isSelected, isDisabled, onToggle }: StockCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        isSelected ? 'border-blue-200 bg-blue-50/40' : 'border-gray-100 bg-white'
      }`}
    >
      {/* Header row: checkbox + ticker + name + score */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            disabled={isDisabled}
            onClick={e => e.stopPropagation()}
            title={isDisabled ? 'Makni jednu dionicu da dodaš novu (maks. 4)' : ''}
            className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed flex-shrink-0"
          />
          <a
            href={tickerToZseUrl(stock.ticker)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 text-[11px] font-mono font-medium px-1.5 py-0.5 rounded-md border border-gray-200 text-gray-700 tracking-wide hover:border-blue-300 hover:text-blue-600 transition-colors"
          >
            {stock.ticker}
          </a>
          <span className="text-sm font-medium text-gray-900 truncate">{stock.name}</span>
        </div>
        {score !== null && (
          <span className={`flex-shrink-0 text-sm font-semibold tabular-nums ml-2 ${scoreColor(score)}`}>
            {score.toFixed(1)}
          </span>
        )}
      </div>

      {/* Price */}
      <div className="text-base font-semibold text-gray-900 mb-3">
        {stock.price !== null ? `${stock.price.toFixed(2)} ${stock.currency}` : '—'}
      </div>

      {/* Main metrics 2×2 */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        <MetricCell label="P/E" value={fmtX(stock.pe_ratio)} />
        <MetricCell label="EV/EBITDA" value={fmtX(stock.ev_ebitda)} />
        <MetricCell
          label="ROE"
          value={fmtPct(stock.roe)}
          colorClass={stock.roe !== null ? (stock.roe > 0 ? 'text-emerald-600' : 'text-red-500') : ''}
        />
        <MetricCell
          label="Neto marža"
          value={fmtPct(stock.net_margin)}
          colorClass={stock.net_margin !== null ? (stock.net_margin > 0 ? 'text-emerald-600' : 'text-red-500') : ''}
        />
      </div>

      {/* Expanded metrics */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-x-4 gap-y-2.5">
          <MetricCell label="ROCE" value={fmtPct(stock.roce)} />
          <MetricCell label="Tržišna kap." value={fmt(stock.market_cap)} />
          <MetricCell label="EBITDA" value={fmt(stock.ebitda)} />
          <MetricCell label="FCF" value={fmt(stock.free_cash_flow)} />
          <MetricCell label="EPS" value={fmt(stock.eps)} />
          <MetricCell label="Div. prinos" value={fmtPct(stock.dividend_yield)} />
          <MetricCell label="P/B" value={fmtX(stock.pb_ratio)} />
          <MetricCell label="Tekuća likv." value={fmtX(stock.current_ratio)} />
          <MetricCell label="Prihod" value={fmt(stock.revenue)} />
          <MetricCell label="EBIT" value={fmt(stock.ebit)} />
        </div>
      )}

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1 py-1 transition-colors"
      >
        {expanded ? 'Prikaži manje' : 'Prikaži više'}
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function StockTable({ stocks, isLoading }: StockTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('ticker');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [activeTab, setActiveTab] = useState<TabId>('pregled');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);

  const scoreMap = useMemo(() => computeScores(stocks), [stocks]);

  // Pre-select from URL on mount (for shared compare links)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tickers = params.get('compare')?.split(',').filter(Boolean) ?? [];
    if (tickers.length >= 2) {
      const available = tickers.filter(t => stocks.some(s => s.ticker === t)).slice(0, 4);
      if (available.length >= 2) {
        setSelected(new Set(available));
        setCompareOpen(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSelect = (ticker: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(ticker)) {
        next.delete(ticker);
      } else if (next.size < 4) {
        next.add(ticker);
      }
      return next;
    });
  };

  const openComparison = () => {
    setCompareOpen(true);
    const params = new URLSearchParams(window.location.search);
    params.set('compare', [...selected].join(','));
    window.history.replaceState({}, '', `?${params.toString()}`);
  };

  const closeComparison = () => {
    setCompareOpen(false);
    const params = new URLSearchParams(window.location.search);
    params.delete('compare');
    const qs = params.toString();
    window.history.replaceState({}, '', qs ? `?${qs}` : window.location.pathname);
  };

  // Column definitions — inside component so score format closes over scoreMap
  const COLUMNS = useMemo<{ key: SortKey; label: string; format: (s: Stock) => ReactNode; align?: string; tip?: string }[]>(
    () => [
      { key: 'ticker', label: 'Ticker', format: (s) => (
        <a
          href={tickerToZseUrl(s.ticker)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-block text-[11px] font-mono font-medium px-1.5 py-0.5 rounded-md border border-gray-200 text-gray-700 tracking-wide hover:border-blue-300 hover:text-blue-600 transition-colors"
        >
          {s.ticker}
        </a>
      )},
      { key: 'name', label: 'Tvrtka', format: (s) => s.name },
      { key: 'price', label: 'Cijena', format: (s) => (s.price ? `${s.price.toFixed(2)} ${s.currency}` : '—') },
      { key: 'pe_ratio', label: 'P/E', format: (s) => fmtX(s.pe_ratio), align: 'right', tip: 'Cijena dionice / Zarada po dionici' },
      { key: 'pb_ratio', label: 'P/B', format: (s) => fmtX(s.pb_ratio), align: 'right', tip: 'Cijena / Knjigovodstvena vrijednost' },
      { key: 'net_margin', label: 'Neto marža', format: (s) => fmtPct(s.net_margin), align: 'right', tip: 'Neto dobit / Prihod' },
      { key: 'roe', label: 'ROE', format: (s) => fmtPct(s.roe), align: 'right', tip: 'Povrat na kapital (Neto dobit / Kapital)' },
      { key: 'buffett_metric', label: 'Buffett metrika', format: (s) => fmt(s.buffett_metric), align: 'right', tip: 'Novac + Kratk. fin. imovina + EBIT × 10' },
      { key: 'market_cap', label: 'Tržišna kap.', format: (s) => fmt(s.market_cap), align: 'right', tip: 'Ukupna tržišna vrijednost tvrtke' },
      { key: 'buffett_undervalue', label: 'Buffett podcijenjenost', format: (s) => fmtPct(s.buffett_undervalue !== null ? s.buffett_undervalue * 100 : null), align: 'right', tip: '(Buffett metrika / Tržišna kap.) − 1' },
      { key: 'roce', label: 'ROCE', format: (s) => fmtPct(s.roce), align: 'right', tip: 'Povrat na angažirani kapital: EBIT / (Aktiva − Kratk. obveze)' },
      { key: 'ebitda', label: 'EBITDA', format: (s) => fmt(s.ebitda), align: 'right', tip: 'Dobit prije kamata, poreza, amortizacije' },
      { key: 'ebit', label: 'EBIT', format: (s) => fmt(s.ebit), align: 'right', tip: 'Dobit prije kamata i poreza' },
      { key: 'ev_ebitda', label: 'EV / EBITDA', format: (s) => fmtX(s.ev_ebitda), align: 'right', tip: 'Vrijednost poduzeća / EBITDA' },
      { key: 'revenue', label: 'Prihod', format: (s) => fmt(s.revenue), align: 'right', tip: 'Ukupni godišnji prihod' },
      { key: 'eps', label: 'EPS', format: (s) => fmt(s.eps), align: 'right', tip: 'Dobit po dionici (Neto dobit / Broj dionica)' },
      { key: 'current_ratio', label: 'Tekuća likvidnost', format: (s) => fmtX(s.current_ratio), align: 'right', tip: 'Kratk. imovina / Kratk. obveze' },
      { key: 'current_assets', label: 'Kratk. imovina', format: (s) => fmt(s.current_assets), align: 'right', tip: 'Kratkotrajna imovina (AOP 006)' },
      { key: 'current_financial_assets', label: 'Kratk. fin. imovina', format: (s) => fmt(s.current_financial_assets), align: 'right', tip: 'Kratkotrajna financijska imovina (AOP 009)' },
      { key: 'current_liabilities', label: 'Kratk. obveze', format: (s) => fmt(s.current_liabilities), align: 'right', tip: 'Kratkoročne obveze (AOP 053)' },
      { key: 'total_assets', label: 'Aktiva', format: (s) => fmt(s.total_assets), align: 'right', tip: 'Ukupna imovina (AOP 013)' },
      { key: 'free_cash_flow', label: 'FCF', format: (s) => fmt(s.free_cash_flow), align: 'right', tip: 'Slobodni novčani tok (Operativni CF − CapEx)' },
      { key: 'dividend', label: 'Dividenda', format: (s) => (s.dividend !== null ? `${s.dividend.toFixed(2)} ${s.currency}` : '—'), align: 'right' },
      { key: 'dividend_yield', label: 'Div. prinos', format: (s) => fmtPct(s.dividend_yield), align: 'right', tip: 'Godišnja dividenda / Cijena dionice' },
      // Score column — closes over scoreMap
      {
        key: 'score',
        label: 'Score',
        align: 'right',
        tip: SCORE_TIP,
        format: (s) => {
          const v = scoreMap.get(s.ticker) ?? null;
          if (v === null) return <span className="text-gray-300">—</span>;
          return (
            <span className={`font-semibold tabular-nums ${scoreColor(v)}`}>
              {v.toFixed(1)}
            </span>
          );
        },
      },
    ],
    [scoreMap]
  );

  const currentTab = TABS.find(t => t.id === activeTab)!;

  const handleTabChange = (tabId: TabId) => {
    const tab = TABS.find(t => t.id === tabId)!;
    setActiveTab(tabId);
    if (!tab.columns.includes(sortKey as string)) {
      setSortKey('ticker');
      setSortDir('asc');
    }
  };

  const activeColumns = COLUMNS.filter(col => currentTab.columns.includes(col.key as string));

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = [...stocks].sort((a, b) => {
    const av = sortKey === 'score' ? (scoreMap.get(a.ticker) ?? null) : a[sortKey as keyof Stock];
    const bv = sortKey === 'score' ? (scoreMap.get(b.ticker) ?? null) : b[sortKey as keyof Stock];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const exportCsv = () => {
    const headers = activeColumns.map((c) => c.label).join(',');
    const rows = sorted
      .map((s) => activeColumns.map((c) => `"${c.format(s)}"`).join(','))
      .join('\n');
    const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fundamenta_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Selected stocks (in display order)
  const selectedStocks = sorted.filter(s => selected.has(s.ticker));

  const currentSortValue = SORT_OPTIONS.some(o => o.key === sortKey && o.dir === sortDir)
    ? `${sortKey}:${sortDir}`
    : '';

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center h-full flex flex-col items-center justify-center">
        <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-gray-400">Učitavanje dionica...</p>
      </div>
    );
  }

  if (stocks.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center h-full flex flex-col items-center justify-center">
        <div className="text-4xl mb-4">🔍</div>
        <p className="text-base font-medium text-gray-700 mb-1">Nema rezultata</p>
        <p className="text-sm text-gray-400">Pokušaj promijeniti filtere ili ih resetirati.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-full flex flex-col">
        {/* Header: tabs + count/sort/export */}
        <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex-shrink-0">
          {/* Tabs — horizontal scroll on mobile */}
          <div className="flex gap-1 mb-3 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-500 hover:text-gray-700 border border-gray-200'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Count + mobile sort dropdown + desktop export */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-500">
              <span className="text-gray-900 font-semibold">{stocks.length}</span> dionica
              {selected.size > 0 && (
                <span className="ml-2 text-blue-600 text-xs">· {selected.size} odabrano</span>
              )}
            </p>
            <div className="flex items-center gap-2">
              {/* Sort dropdown — mobile only */}
              <select
                className="sm:hidden text-xs text-gray-600 border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={currentSortValue}
                onChange={e => {
                  if (!e.target.value) return;
                  const [key, dir] = e.target.value.split(':') as [SortKey, SortDir];
                  setSortKey(key);
                  setSortDir(dir);
                }}
              >
                {!currentSortValue && <option value="" disabled>Sortiraj po...</option>}
                {SORT_OPTIONS.map(opt => (
                  <option key={`${opt.key}:${opt.dir}`} value={`${opt.key}:${opt.dir}`}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Export CSV — desktop only */}
              <button
                onClick={exportCsv}
                className="hidden sm:flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* ── Mobile card list (below sm) ── */}
        <div className={`sm:hidden flex-1 min-h-0 overflow-auto p-3 space-y-2 ${selected.size > 0 ? 'pb-24' : ''}`}>
          {sorted.map(stock => (
            <StockCard
              key={stock.ticker}
              stock={stock}
              score={scoreMap.get(stock.ticker) ?? null}
              isSelected={selected.has(stock.ticker)}
              isDisabled={!selected.has(stock.ticker) && selected.size >= 4}
              onToggle={() => toggleSelect(stock.ticker)}
            />
          ))}
        </div>

        {/* ── Desktop table (sm+) ── */}
        <div className={`hidden sm:block flex-1 min-h-0 overflow-auto ${selected.size > 0 ? 'pb-20' : ''}`}>
          <table className="w-full text-xs sm:text-sm">
            <thead className="sticky top-0 z-30">
              <tr className="border-b border-gray-100 bg-white">
                {/* Checkbox column header */}
                <th className="w-9 pl-2 sm:pl-3 pr-0 sticky left-0 z-20 bg-white" />
                {activeColumns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-2 py-2 sm:px-4 sm:py-3 text-xs font-semibold uppercase tracking-wide
                                cursor-pointer select-none whitespace-nowrap transition-colors bg-white
                                ${col.align === 'right' ? 'text-right' : 'text-left'}
                                ${col.key === 'ticker' ? 'sticky left-9 z-20 border-r border-gray-100' : ''}
                                ${sortKey === col.key ? 'text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.tip && (
                        <span title={col.tip} className="text-blue-300 hover:text-blue-500 cursor-default select-none text-xs transition-colors">ⓘ</span>
                      )}
                      <svg
                        className={`w-3 h-3 flex-shrink-0 transition-all ${
                          sortKey === col.key
                            ? sortDir === 'asc' ? 'rotate-180' : ''
                            : 'opacity-20'
                        }`}
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M7 10l5 5 5-5z" />
                      </svg>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((stock) => {
                const isSelected = selected.has(stock.ticker);
                const isDisabled = !isSelected && selected.size >= 4;
                return (
                  <tr
                    key={stock.ticker}
                    className={`hover:bg-slate-50 transition-colors group cursor-pointer ${isSelected ? 'bg-blue-50/40' : ''}`}
                    onClick={() => !isDisabled && toggleSelect(stock.ticker)}
                  >
                    {/* Checkbox cell */}
                    <td className="pl-2 sm:pl-3 pr-0 py-2 sm:py-3 sticky left-0 z-10 bg-white group-hover:bg-slate-50" style={isSelected ? { background: 'rgb(239 246 255 / 0.4)' } : {}}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => !isDisabled && toggleSelect(stock.ticker)}
                        disabled={isDisabled}
                        onClick={e => e.stopPropagation()}
                        title={isDisabled ? 'Makni jednu dionicu da dodaš novu (maks. 4)' : ''}
                        className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
                      />
                    </td>
                    {activeColumns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap
                          ${col.align === 'right' ? 'text-right' : ''}
                          ${col.key === 'ticker' ? 'sticky left-9 z-10 bg-white group-hover:bg-slate-50 border-r border-gray-100' : 'text-gray-600'}
                          ${col.key === 'name' ? 'max-w-[120px] sm:max-w-[200px] truncate' : ''}
                          ${getColorClass(col.key, stock)}`}
                        style={isSelected && col.key === 'ticker' ? { background: 'rgb(255 255 255)' } : {}}
                      >
                        {col.format(stock)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Sticky selection bar ── */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-4 pb-4 pt-3 pointer-events-none">
          <div
            className="bg-white/92 backdrop-blur-xl border border-gray-200 shadow-xl rounded-2xl px-4 py-3 pointer-events-auto w-full"
            style={{ maxWidth: '700px' }}
          >
            {/* Desktop: chips + actions */}
            <div className="hidden sm:flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 flex-wrap min-w-0">
                {[...selected].map(ticker => (
                  <span
                    key={ticker}
                    className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-mono font-medium pl-2.5 pr-1 py-1 rounded-full"
                  >
                    {ticker}
                    <button
                      onClick={() => toggleSelect(ticker)}
                      className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-blue-200 transition-colors"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
                {selected.size < 4 && (
                  <span className="text-xs text-gray-400 italic">
                    {selected.size === 1 ? 'Odaberi još jednu za usporedbu' : `+ još ${4 - selected.size}`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1"
                >
                  Poništi
                </button>
                <button
                  onClick={openComparison}
                  disabled={selected.size < 2}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 active:bg-blue-800 transition-colors"
                >
                  Usporedi →
                </button>
              </div>
            </div>

            {/* Mobile: compact bar */}
            <div className="sm:hidden flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
                <span className="text-sm text-gray-700 font-medium">
                  {selected.size} {selected.size === 1 ? 'dionica odabrana' : 'dionice odabrane'}
                </span>
                {selected.size === 1 && (
                  <span className="text-xs text-gray-400 italic truncate">+ još jedna</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-1.5 py-1"
                >
                  Poništi
                </button>
                <button
                  onClick={openComparison}
                  disabled={selected.size < 2}
                  className="px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 active:bg-blue-800 transition-colors"
                >
                  Usporedi →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comparison modal */}
      {compareOpen && (
        <CompareModal
          stocks={selectedStocks}
          scoreMap={scoreMap}
          onClose={closeComparison}
        />
      )}
    </>
  );
}
