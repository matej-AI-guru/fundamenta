'use client';

import { useState } from 'react';
import type { Stock } from '@/lib/supabase';

interface StockTableProps {
  stocks: Stock[];
  isLoading: boolean;
}

type SortKey = keyof Stock;
type SortDir = 'asc' | 'desc';

function fmt(v: number | null, decimals = 2): string {
  if (v === null || v === undefined) return '—';
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(decimals);
}
const fmtPct = (v: number | null) => (v !== null ? `${v.toFixed(2)}%` : '—');
const fmtX = (v: number | null) => (v !== null ? `${v.toFixed(2)}x` : '—');

const COLUMNS: { key: SortKey; label: string; format: (s: Stock) => string; align?: string; hideOnMobile?: boolean }[] = [
  { key: 'ticker', label: 'Ticker', format: (s) => s.ticker },
  { key: 'name', label: 'Tvrtka', format: (s) => s.name },
  { key: 'price', label: 'Cijena', format: (s) => (s.price ? `${s.price.toFixed(2)} ${s.currency}` : '—') },
  { key: 'pe_ratio', label: 'P/E', format: (s) => fmtX(s.pe_ratio), align: 'right' },
  { key: 'pb_ratio', label: 'P/B', format: (s) => fmtX(s.pb_ratio), align: 'right' },
  { key: 'net_margin', label: 'Neto marža', format: (s) => fmtPct(s.net_margin), align: 'right' },
  { key: 'roe', label: 'ROE', format: (s) => fmtPct(s.roe), align: 'right' },
  { key: 'ebitda_ttm', label: 'EBITDA (TTM)', format: (s) => fmt(s.ebitda_ttm), align: 'right', hideOnMobile: true },
  { key: 'ev_ebitda', label: 'EV/EBITDA', format: (s) => fmtX(s.ev_ebitda), align: 'right' },
  { key: 'revenue_ttm', label: 'Prihod (TTM)', format: (s) => fmt(s.revenue_ttm), align: 'right', hideOnMobile: true },
  { key: 'eps_ttm', label: 'EPS', format: (s) => fmt(s.eps_ttm), align: 'right', hideOnMobile: true },
];

function getColorClass(key: SortKey, stock: Stock): string {
  if (key === 'net_margin' && stock.net_margin !== null) {
    return stock.net_margin > 0 ? 'text-emerald-600' : 'text-red-500';
  }
  if (key === 'roe' && stock.roe !== null) {
    return stock.roe > 0 ? 'text-emerald-600' : 'text-red-500';
  }
  return '';
}

export default function StockTable({ stocks, isLoading }: StockTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('ticker');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [watchlist, setWatchlist] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem('fundamenta_watchlist') ?? '[]'));
    } catch {
      return new Set();
    }
  });

  const toggleWatchlist = (ticker: string) => {
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      localStorage.setItem('fundamenta_watchlist', JSON.stringify([...next]));
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = [...stocks].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const exportCsv = () => {
    const headers = COLUMNS.map((c) => c.label).join(',');
    const rows = sorted
      .map((s) => COLUMNS.map((c) => `"${c.format(s)}"`).join(','))
      .join('\n');
    const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fundamenta_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-full flex flex-col">
      {/* Table header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">
          <span className="text-gray-900 font-semibold">{stocks.length}</span> dionica
        </p>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Scrollable table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead className="sticky top-0 z-30">
            <tr className="border-b border-gray-100 bg-white">
              <th className="hidden sm:table-cell pl-6 pr-2 py-3 text-left sticky left-0 bg-white z-20 w-12" />
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-2 py-2 sm:px-4 sm:py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide
                              cursor-pointer hover:text-gray-700 select-none whitespace-nowrap transition-colors bg-white
                              ${col.align === 'right' ? 'text-right' : 'text-left'}
                              ${col.key === 'ticker' ? 'sticky left-0 sm:left-12 z-20 border-r border-gray-100' : ''}
                              ${col.hideOnMobile ? 'hidden sm:table-cell' : ''}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      <svg
                        className={`w-3 h-3 ${sortDir === 'asc' ? 'rotate-180' : ''} transition-transform`}
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M7 10l5 5 5-5z" />
                      </svg>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((stock) => (
              <tr key={stock.ticker} className="hover:bg-gray-50 transition-colors group">
                {/* Watchlist star */}
                <td className="hidden sm:table-cell pl-6 pr-2 py-3 sticky left-0 z-10 bg-white group-hover:bg-gray-50 w-12">
                  <button
                    onClick={() => toggleWatchlist(stock.ticker)}
                    className={`transition-colors ${
                      watchlist.has(stock.ticker)
                        ? 'text-amber-400'
                        : 'text-gray-200 group-hover:text-gray-300'
                    }`}
                    title={watchlist.has(stock.ticker) ? 'Ukloni iz watchliste' : 'Dodaj u watchlistu'}
                  >
                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                </td>
                {COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className={`px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap ${
                      col.align === 'right' ? 'text-right' : ''
                    } ${col.key === 'ticker' ? 'font-semibold text-gray-900 sticky left-0 sm:left-12 z-10 bg-white group-hover:bg-gray-50 border-r border-gray-100' : 'text-gray-600'}
                    ${col.key === 'name' ? 'max-w-[120px] sm:max-w-[200px] truncate' : ''}
                    ${col.hideOnMobile ? 'hidden sm:table-cell' : ''}
                    ${getColorClass(col.key, stock)}`}
                  >
                    {col.format(stock)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
