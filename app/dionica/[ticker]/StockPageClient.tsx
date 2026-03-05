'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import type { Stock, StockFinancials } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Scores {
  overall: number | null;
  valuation: number | null;
  profitability: number | null;
  health: number | null;
}

interface Props {
  stock: Stock;
  financials: StockFinancials[];
  scores: Scores;
  sector: string;
  similarStocks: Stock[];
  zseMedians: Record<string, number | null>;
  sifSim: string;
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
const fmtX   = (v: number | null) => (v !== null ? `${v.toFixed(2)}x` : '—');

function fmtLarge(v: number): string {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  return String(Math.round(v));
}

function scoreColor(v: number | null): string {
  if (v === null) return 'text-gray-400';
  if (v >= 7) return 'text-emerald-600';
  if (v >= 4) return 'text-amber-500';
  return 'text-red-500';
}

function scoreBg(v: number | null): string {
  if (v === null) return 'bg-gray-200';
  if (v >= 7) return 'bg-emerald-500';
  if (v >= 4) return 'bg-amber-400';
  return 'bg-red-500';
}

// CAGR computation
function cagr(start: number | null, end: number | null, years: number): number | null {
  if (start === null || end === null || start === 0 || years <= 0) return null;
  if (start < 0 || end < 0) return null;
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}

// ---------------------------------------------------------------------------
// Sparkline (pure SVG — no dependency)
// ---------------------------------------------------------------------------
function Sparkline({ values, color = '#3b82f6' }: { values: (number | null)[]; color?: string }) {
  const valid = values.filter((v): v is number => v !== null && isFinite(v));
  if (valid.length < 2) return <div className="h-8 w-full" />;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const pts = valid
    .map((v, i) => `${(i / (valid.length - 1)) * 100},${100 - ((v - min) / range) * 100}`)
    .join(' ');
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-8 w-full">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="4"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Score bar component
// ---------------------------------------------------------------------------
function ScoreBar({ label, value, tip }: { label: string; value: number | null; tip?: string }) {
  const pct = value !== null ? (value / 10) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        {tip && <span className="text-[10px] text-gray-400 hidden sm:block">{tip}</span>}
        <span className={`font-semibold tabular-nums ${scoreColor(value)}`}>
          {value !== null ? `${value.toFixed(1)}/10` : '—'}
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${scoreBg(value)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Financial table helpers
// ---------------------------------------------------------------------------
interface TableRow {
  label: string;
  values: (number | null)[];
  format: 'currency' | 'pct' | 'ratio' | 'plain';
  bold?: boolean;
  separator?: boolean;
}

function formatCell(v: number | null, format: TableRow['format']): string {
  if (v === null) return '—';
  switch (format) {
    case 'currency': return fmt(v);
    case 'pct':      return fmtPct(v);
    case 'ratio':    return fmtX(v);
    case 'plain':    return v.toFixed(2);
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function StockPageClient({
  stock, financials, scores, sector, similarStocks, zseMedians, sifSim,
}: Props) {
  const [chartView, setChartView] = useState<'revenue' | 'profitability' | 'cashflow'>('revenue');
  const [tableTab, setTableTab] = useState<'rdg' | 'bilanca' | 'cf'>('rdg');

  const years = financials.map(f => f.year);
  const latestFin = financials[financials.length - 1] ?? null;
  const earliestFin = financials[0] ?? null;
  const nYears = years.length > 1 ? years[years.length - 1] - years[0] : 0;

  // Chart data
  const chartData = financials.map(f => ({
    year: String(f.year),
    prihod:    f.revenue,
    ebitda:    f.ebitda,
    netoDobit: f.net_profit,
    netoMarza: f.net_margin,
    roe:       f.roe,
    roce:      f.roce,
    ocf:       f.operating_cash_flow,
    fcf:       f.free_cash_flow,
    capex:     f.capex !== null ? -f.capex : null,
  }));

  // Valuation metrics for dashboard
  const valMetrics = [
    {
      label: 'P/E',
      value: stock.pe_ratio,
      unit: 'x',
      median: zseMedians.pe_ratio,
      lowerIsBetter: true,
      sparkValues: financials.map(f => f.eps),
      sparkLabel: 'EPS trend',
      description: 'Cijena / Zarada po dionici',
    },
    {
      label: 'P/B',
      value: stock.pb_ratio,
      unit: 'x',
      median: zseMedians.pb_ratio,
      lowerIsBetter: true,
      sparkValues: financials.map(f => f.equity),
      sparkLabel: 'Kapital trend',
      description: 'Cijena / Knjigovodstvena vrijednost',
    },
    {
      label: 'EV/EBITDA',
      value: stock.ev_ebitda,
      unit: 'x',
      median: zseMedians.ev_ebitda,
      lowerIsBetter: true,
      sparkValues: financials.map(f => f.ebitda),
      sparkLabel: 'EBITDA trend',
      description: 'Vrijednost poduzeća / EBITDA',
    },
    {
      label: 'P/S',
      value: stock.ps_ratio,
      unit: 'x',
      median: zseMedians.ps_ratio,
      lowerIsBetter: true,
      sparkValues: financials.map(f => f.revenue),
      sparkLabel: 'Prihod trend',
      description: 'Cijena / Prihod po dionici',
    },
    {
      label: 'P/FCF',
      value: stock.pfcf_ratio,
      unit: 'x',
      median: zseMedians.pfcf_ratio,
      lowerIsBetter: true,
      sparkValues: financials.map(f => f.free_cash_flow),
      sparkLabel: 'FCF trend',
      description: 'Cijena / Slobodni novčani tok po dionici',
    },
    {
      label: 'Prinos od zarade',
      value: stock.earnings_yield,
      unit: '%',
      median: zseMedians.earnings_yield,
      lowerIsBetter: false,
      sparkValues: financials.map(f => f.eps),
      sparkLabel: 'EPS trend',
      description: '1 / P/E × 100% (koliko zaradiš po EUR uloženom)',
    },
  ];

  // Profitability metrics
  const profMetrics = [
    {
      label: 'Neto marža',
      key: 'net_margin' as keyof StockFinancials,
      value: stock.net_margin,
      median: zseMedians.net_margin,
      allStockVals: [] as number[],
      format: 'pct' as const,
      description: 'Neto dobit / Prihod',
    },
    {
      label: 'ROE',
      key: 'roe' as keyof StockFinancials,
      value: stock.roe,
      median: zseMedians.roe,
      allStockVals: [] as number[],
      format: 'pct' as const,
      description: 'Povrat na kapital',
    },
    {
      label: 'ROCE',
      key: 'roce' as keyof StockFinancials,
      value: stock.roce,
      median: zseMedians.roce,
      allStockVals: [] as number[],
      format: 'pct' as const,
      description: 'Povrat na angažirani kapital',
    },
  ];

  // Financial tables
  const rdgRows: TableRow[] = [
    { label: 'Prihod',     values: financials.map(f => f.revenue),    format: 'currency', bold: true },
    { label: 'EBITDA',     values: financials.map(f => f.ebitda),     format: 'currency' },
    { label: 'EBIT',       values: financials.map(f => f.ebit),       format: 'currency' },
    { label: 'Amortizacija', values: financials.map(f => f.depreciation), format: 'currency' },
    { label: 'Neto dobit', values: financials.map(f => f.net_profit), format: 'currency', bold: true },
    { label: '', values: [], format: 'plain', separator: true },
    { label: 'EPS',        values: financials.map(f => f.eps),        format: 'plain' },
    { label: 'Neto marža', values: financials.map(f => f.net_margin), format: 'pct' },
  ];

  const bilancaRows: TableRow[] = [
    { label: 'Ukupna aktiva',      values: financials.map(f => f.total_assets),    format: 'currency', bold: true },
    { label: 'Kratkotrajna imovina', values: financials.map(f => f.current_assets), format: 'currency' },
    { label: 'Kratk. fin. imovina', values: financials.map(f => f.current_financial_assets), format: 'currency' },
    { label: 'Novac',              values: financials.map(f => f.cash),            format: 'currency' },
    { label: '', values: [], format: 'plain', separator: true },
    { label: 'Kapital',            values: financials.map(f => f.equity),          format: 'currency', bold: true },
    { label: 'Dugoročne obveze',   values: financials.map(f => f.long_term_liabilities), format: 'currency' },
    { label: 'Kratkoročne obveze', values: financials.map(f => f.current_liabilities), format: 'currency' },
    { label: '', values: [], format: 'plain', separator: true },
    { label: 'Tekuća likvidnost',  values: financials.map(f => f.current_ratio),  format: 'ratio' },
    { label: 'ROE',                values: financials.map(f => f.roe),             format: 'pct' },
  ];

  const cfRows: TableRow[] = [
    { label: 'Operativni CF',      values: financials.map(f => f.operating_cash_flow), format: 'currency', bold: true },
    { label: 'CapEx',              values: financials.map(f => f.capex !== null ? -f.capex : null), format: 'currency' },
    { label: 'Slobodni CF (FCF)',  values: financials.map(f => f.free_cash_flow),      format: 'currency', bold: true },
    { label: '', values: [], format: 'plain', separator: true },
    { label: 'ROCE',               values: financials.map(f => f.roce),               format: 'pct' },
  ];

  const activeRows = tableTab === 'rdg' ? rdgRows : tableTab === 'bilanca' ? bilancaRows : cfRows;

  const mojeUrl = `https://www.mojedionice.com/dionica/${sifSim}`;

  return (
    <div className="min-h-screen bg-gray-50/50">

      {/* ── NAV ── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-base font-bold text-gray-900">Fundamenta</span>
            <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
              ZSE screener
            </span>
          </Link>
          <nav className="hidden sm:flex items-center gap-5">
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">Screener</Link>
            <Link href="/metodologija" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">Metodologija</Link>
          </nav>
        </div>
      </header>

      {/* ── 1. HERO ── */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-2">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
          <Link href="/" className="hover:text-gray-600 transition-colors">Screener</Link>
          <span>/</span>
          <span className="text-gray-600 font-medium">{stock.ticker}</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          {/* Left */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{stock.name}</h1>
            <div className="flex items-center flex-wrap gap-2 mt-2">
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                {stock.ticker}
              </span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-500">ZSE</span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-500">{sector}</span>
            </div>
          </div>
          {/* Right: price */}
          <div className="sm:text-right">
            <p className="text-3xl font-bold text-gray-900 tabular-nums">
              {stock.price !== null ? stock.price.toFixed(2) : '—'}
              <span className="text-base font-normal text-gray-400 ml-1">{stock.currency}</span>
            </p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Tržišna kap.', value: fmt(stock.market_cap), suffix: stock.currency },
            { label: 'Div. prinos',  value: stock.dividend_yield !== null ? stock.dividend_yield.toFixed(2) : '—', suffix: '%' },
            { label: 'Score',        value: scores.overall !== null ? scores.overall.toFixed(1) : '—', suffix: '/ 10', color: scoreColor(scores.overall) },
            { label: 'Buffett podcijenj.', value: stock.buffett_undervalue !== null ? `${(stock.buffett_undervalue * 100) > 0 ? '+' : ''}${(stock.buffett_undervalue * 100).toFixed(1)}` : '—', suffix: '%', color: stock.buffett_undervalue !== null ? (stock.buffett_undervalue > 0 ? 'text-emerald-600' : 'text-red-500') : '' },
            { label: 'Tekuća likv.', value: stock.current_ratio !== null ? stock.current_ratio.toFixed(2) : '—', suffix: 'x' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-3.5 shadow-sm">
              <p className="text-[11px] text-gray-400 mb-1">{stat.label}</p>
              <p className={`text-lg font-bold tabular-nums ${stat.color ?? 'text-gray-900'}`}>
                {stat.value}
                <span className="text-sm font-normal text-gray-400 ml-0.5">{stat.suffix}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 2. VALUACIJSKI DASHBOARD ── */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Valuacija</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {valMetrics.map((m) => {
            const isFavorable = m.lowerIsBetter
              ? (m.value !== null && m.median !== null ? m.value < m.median : false)
              : (m.value !== null && m.median !== null ? m.value > m.median : false);
            const valStr = m.unit === '%' ? fmtPct(m.value) : fmtX(m.value);
            const medStr = m.unit === '%' ? fmtPct(m.median) : fmtX(m.median);
            return (
              <div key={m.label} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm text-gray-500 font-medium">{m.label}</p>
                  <span className="text-[10px] text-gray-400 text-right leading-tight max-w-[120px] hidden sm:block">{m.description}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 mb-2 tabular-nums">
                  {valStr}
                </p>
                <Sparkline values={m.sparkValues} />
                <div className="flex items-center justify-between text-xs mt-2">
                  <span className="text-gray-400">Medijan ZSE: {medStr}</span>
                  {m.value !== null && m.median !== null && (
                    <span className={isFavorable ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
                      {isFavorable
                        ? (m.lowerIsBetter ? '✓ Ispod medijana' : '✓ Iznad medijana')
                        : (m.lowerIsBetter ? '▲ Iznad medijana' : '▼ Ispod medijana')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 3. PROFITABILNOST ── */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Profitabilnost</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {profMetrics.map((m) => (
            <div key={m.label} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm text-gray-500 font-medium">{m.label}</p>
                <span className="text-[10px] text-gray-400">{m.description}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-3 tabular-nums">
                {m.value !== null ? `${m.value.toFixed(2)}%` : '—'}
              </p>
              {/* Mini table: historical values */}
              {financials.length > 0 && (
                <div className="space-y-1 border-t border-gray-50 pt-3">
                  {financials.map(f => {
                    const val = f[m.key] as number | null;
                    return (
                      <div key={f.year} className="flex justify-between text-xs">
                        <span className="text-gray-400">{f.year}</span>
                        <span className={`font-medium tabular-nums ${val !== null && val < 0 ? 'text-red-500' : 'text-gray-700'}`}>
                          {val !== null ? `${val.toFixed(1)}%` : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {m.median !== null && m.value !== null && (
                <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-gray-50">
                  <span className="text-gray-400">Medijan ZSE: {m.median.toFixed(1)}%</span>
                  <span className={m.value > m.median ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
                    {m.value > m.median ? '✓ Iznad' : '▼ Ispod'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. POVIJESNI GRAF ── */}
      {financials.length > 0 && (
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <h2 className="text-lg font-bold text-gray-900">Financijski pregled</h2>
              {/* Toggle */}
              <div className="flex gap-0.5 bg-gray-50 rounded-lg p-0.5 self-start sm:self-auto">
                {([
                  { id: 'revenue'       as const, label: 'Prihod'        },
                  { id: 'profitability' as const, label: 'Profitabilnost' },
                  { id: 'cashflow'      as const, label: 'Cash Flow'     },
                ] as const).map(v => (
                  <button
                    key={v.id}
                    onClick={() => setChartView(v.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      chartView === v.id
                        ? 'bg-white shadow-sm text-gray-900'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                {chartView === 'revenue' ? (
                  <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtLarge} width={60} />
                    <Tooltip formatter={(v) => typeof v === 'number' ? fmtLarge(v) : String(v ?? '')} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="prihod"    name="Prihod"     fill="#93c5fd" radius={[3,3,0,0]} />
                    <Bar dataKey="ebitda"   name="EBITDA"     fill="#3b82f6" radius={[3,3,0,0]} />
                    <Line dataKey="netoDobit" name="Neto dobit" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                ) : chartView === 'profitability' ? (
                  <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v.toFixed(1)}%`} width={55} />
                    <Tooltip formatter={(v) => typeof v === 'number' ? `${v.toFixed(2)}%` : String(v ?? '')} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                    <Line dataKey="netoMarza" name="Neto marža" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                    <Line dataKey="roe"       name="ROE"        stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                    <Line dataKey="roce"      name="ROCE"       stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                ) : (
                  <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtLarge} width={60} />
                    <Tooltip formatter={(v) => typeof v === 'number' ? fmtLarge(v) : String(v ?? '')} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="ocf"  name="Operativni CF" fill="#93c5fd" radius={[3,3,0,0]} />
                    <Bar dataKey="fcf"  name="FCF"           fill="#3b82f6" radius={[3,3,0,0]} />
                    <Bar dataKey="capex" name="CapEx"        fill="#fca5a5" radius={[3,3,0,0]} />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* ── 5. FINANCIJSKE TABLICE ── */}
      {financials.length > 0 && (
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {([
                { id: 'rdg'    as const, label: 'RDG'          },
                { id: 'bilanca'as const, label: 'Bilanca'       },
                { id: 'cf'     as const, label: 'Novčani tok'   },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTableTab(t.id)}
                  className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                    tableTab === t.id
                      ? 'text-blue-600 border-blue-600'
                      : 'text-gray-500 border-transparent hover:text-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
              <div className="flex-1" />
              <span className="self-center text-xs text-gray-400 pr-4 hidden sm:block">u EUR</span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="text-left text-xs text-gray-400 font-medium py-2.5 px-5 sticky left-0 bg-white min-w-[160px]">
                      Pokazatelj
                    </th>
                    {years.map((yr) => (
                      <th key={yr} className="text-right text-xs text-gray-400 font-medium py-2.5 px-4 min-w-[100px] tabular-nums">
                        {yr}
                      </th>
                    ))}
                    {nYears > 0 && (
                      <th className="text-right text-xs text-gray-400 font-medium py-2.5 px-4 min-w-[80px] border-l border-gray-50">
                        CAGR
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50/70">
                  {activeRows.map((row, idx) => {
                    if (row.separator) {
                      return <tr key={idx}><td colSpan={years.length + 2} className="py-0.5 bg-gray-50/40" /></tr>;
                    }
                    const cagrVal = nYears > 0
                      ? cagr(row.values[0] ?? null, row.values[row.values.length - 1] ?? null, nYears)
                      : null;
                    return (
                      <tr key={row.label + idx} className="hover:bg-blue-50/20 transition-colors">
                        <td className={`text-xs py-2.5 px-5 sticky left-0 bg-white ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                          {row.label}
                        </td>
                        {row.values.map((v, vi) => (
                          <td key={vi} className={`text-xs text-right py-2.5 px-4 tabular-nums ${v !== null && v < 0 ? 'text-red-500' : 'text-gray-700'} ${row.bold ? 'font-semibold' : ''}`}>
                            {formatCell(v, row.format)}
                          </td>
                        ))}
                        {nYears > 0 && (
                          <td className="text-xs text-right py-2.5 px-4 tabular-nums border-l border-gray-50">
                            {cagrVal !== null ? (
                              <span className={cagrVal >= 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                                {cagrVal > 0 ? '+' : ''}{cagrVal.toFixed(1)}%
                              </span>
                            ) : '—'}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── 6. SCORE + SAŽETAK ── */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900">Kompozitni score</h2>
            <Link href="/metodologija" className="text-xs text-blue-500 hover:text-blue-600 transition-colors">
              Kako računamo score? →
            </Link>
          </div>
          <div className="space-y-4">
            <ScoreBar label="Ukupni score" value={scores.overall} />
            <div className="h-px bg-gray-50 my-2" />
            <ScoreBar label="Valuacija"          value={scores.valuation}     tip="P/E, P/B, EV/EBITDA" />
            <ScoreBar label="Profitabilnost"     value={scores.profitability} tip="ROCE, Neto marža, ROE" />
            <ScoreBar label="Financijsko zdravlje" value={scores.health}      tip="Tekuća likvidnost, FCF" />
          </div>
        </div>
      </section>

      {/* ── 7. SLIČNE DIONICE ── */}
      {similarStocks.length > 0 && (
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Slične dionice</h2>
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {similarStocks.map((s) => (
              <Link
                key={s.ticker}
                href={`/dionica/${s.ticker}`}
                className="flex-shrink-0 bg-white rounded-xl border border-gray-100 shadow-sm p-4 w-40 hover:border-blue-200 hover:shadow-md transition-all"
              >
                <span className="text-xs font-mono font-semibold text-gray-700 block mb-1">{s.ticker}</span>
                <span className="text-xs text-gray-500 block mb-2 truncate leading-tight">{s.name}</span>
                <span className="text-base font-bold text-gray-900 tabular-nums block">
                  {s.price !== null ? s.price.toFixed(0) : '—'}
                  <span className="text-xs font-normal text-gray-400 ml-0.5">{s.currency}</span>
                </span>
                {s.pe_ratio !== null && (
                  <span className="text-[11px] text-gray-400">P/E {s.pe_ratio.toFixed(1)}x</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
