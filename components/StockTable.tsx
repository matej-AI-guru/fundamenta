'use client';

import { useState } from 'react';
import type { Stock } from '@/lib/supabase';

interface StockTableProps {
  stocks: Stock[];
  isLoading: boolean;
}

type SortKey = keyof Stock;
type SortDir = 'asc' | 'desc';
type TabId = 'pregled' | 'vrednovanje' | 'profitabilnost' | 'bilanca';

function fmt(v: number | null, decimals = 2): string {
  if (v === null || v === undefined) return '—';
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(decimals);
}
const fmtPct = (v: number | null) => (v !== null ? `${v.toFixed(2)}%` : '—');
const fmtX = (v: number | null) => (v !== null ? `${v.toFixed(2)}x` : '—');

const TABS: { id: TabId; label: string; columns: string[] }[] = [
  {
    id: 'pregled',
    label: 'Pregled',
    columns: ['ticker', 'name', 'price', 'pe_ratio', 'ev_ebitda', 'dividend_yield', 'dividend'],
  },
  {
    id: 'vrednovanje',
    label: 'Valuacija',
    columns: ['ticker', 'price', 'market_cap', 'buffett_metric', 'buffett_undervalue', 'ev_ebitda', 'pe_ratio', 'pb_ratio'],
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

const COLUMNS: { key: SortKey; label: string; format: (s: Stock) => string; align?: string }[] = [
  { key: 'ticker', label: 'Ticker', format: (s) => s.ticker },
  { key: 'name', label: 'Tvrtka', format: (s) => s.name },
  { key: 'price', label: 'Cijena', format: (s) => (s.price ? `${s.price.toFixed(2)} ${s.currency}` : '—') },
  { key: 'pe_ratio', label: 'P/E', format: (s) => fmtX(s.pe_ratio), align: 'right' },
  { key: 'pb_ratio', label: 'P/B', format: (s) => fmtX(s.pb_ratio), align: 'right' },
  { key: 'net_margin', label: 'Neto marža', format: (s) => fmtPct(s.net_margin), align: 'right' },
  { key: 'roe', label: 'ROE', format: (s) => fmtPct(s.roe), align: 'right' },
  { key: 'buffett_metric', label: 'Buffett metrika', format: (s) => fmt(s.buffett_metric), align: 'right' },
  { key: 'market_cap', label: 'Tržišna kap.', format: (s) => fmt(s.market_cap), align: 'right' },
  { key: 'buffett_undervalue', label: 'Buffett podcijenjenost', format: (s) => fmtPct(s.buffett_undervalue !== null ? s.buffett_undervalue * 100 : null), align: 'right' },
  { key: 'roce', label: 'ROCE', format: (s) => fmtPct(s.roce), align: 'right' },
  { key: 'ebitda', label: 'EBITDA', format: (s) => fmt(s.ebitda), align: 'right' },
  { key: 'ebit', label: 'EBIT', format: (s) => fmt(s.ebit), align: 'right' },
  { key: 'ev_ebitda', label: 'EV / EBITDA', format: (s) => fmtX(s.ev_ebitda), align: 'right' },
  { key: 'revenue', label: 'Prihod', format: (s) => fmt(s.revenue), align: 'right' },
  { key: 'eps', label: 'EPS', format: (s) => fmt(s.eps), align: 'right' },
  { key: 'current_ratio', label: 'Tekuća likvidnost', format: (s) => fmtX(s.current_ratio), align: 'right' },
  { key: 'current_assets', label: 'Kratk. imovina', format: (s) => fmt(s.current_assets), align: 'right' },
  { key: 'current_financial_assets', label: 'Kratk. fin. imovina', format: (s) => fmt(s.current_financial_assets), align: 'right' },
  { key: 'current_liabilities', label: 'Kratk. obveze', format: (s) => fmt(s.current_liabilities), align: 'right' },
  { key: 'total_assets', label: 'Aktiva', format: (s) => fmt(s.total_assets), align: 'right' },
  { key: 'free_cash_flow', label: 'FCF', format: (s) => fmt(s.free_cash_flow), align: 'right' },
  { key: 'dividend', label: 'Dividenda', format: (s) => (s.dividend !== null ? `${s.dividend.toFixed(2)} ${s.currency}` : '—'), align: 'right' },
  { key: 'dividend_yield', label: 'Div. prinos', format: (s) => fmtPct(s.dividend_yield), align: 'right' },
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
  const [activeTab, setActiveTab] = useState<TabId>('pregled');
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
    const av = a[sortKey];
    const bv = b[sortKey];
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
      {/* Header: tabs + count/export */}
      <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex gap-1 mb-3 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-500 hover:text-gray-700 border border-gray-200'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between">
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
      </div>

      {/* Scrollable table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead className="sticky top-0 z-30">
            <tr className="border-b border-gray-100 bg-white">
              {activeColumns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-2 py-2 sm:px-4 sm:py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide
                              cursor-pointer hover:text-gray-700 select-none whitespace-nowrap transition-colors bg-white
                              ${col.align === 'right' ? 'text-right' : 'text-left'}
                              ${col.key === 'ticker' ? 'sticky left-0 z-20 border-r border-gray-100' : ''}`}
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
                {activeColumns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap
                      ${col.align === 'right' ? 'text-right' : ''}
                      ${col.key === 'ticker' ? 'font-semibold text-gray-900 sticky left-0 z-10 bg-white group-hover:bg-gray-50 border-r border-gray-100' : 'text-gray-600'}
                      ${col.key === 'name' ? 'max-w-[120px] sm:max-w-[200px] truncate' : ''}
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
