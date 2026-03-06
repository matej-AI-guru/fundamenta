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
  sectorMedians: Record<string, number | null> | null;
  description: string | null;
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
  if (v >= 8)   return 'text-emerald-600';
  if (v >= 6.5) return 'text-green-600';
  if (v >= 5)   return 'text-amber-500';
  if (v >= 3.5) return 'text-orange-500';
  return 'text-red-500';
}

function scoreBg(v: number | null): string {
  if (v === null) return 'bg-gray-200';
  if (v >= 8)   return 'bg-emerald-500';
  if (v >= 6.5) return 'bg-green-400';
  if (v >= 5)   return 'bg-amber-400';
  if (v >= 3.5) return 'bg-orange-400';
  return 'bg-red-400';
}

function scoreLabel(v: number | null): string {
  if (v === null) return '';
  if (v >= 8)   return 'Odlično';
  if (v >= 6.5) return 'Dobro';
  if (v >= 5)   return 'Prosječno';
  if (v >= 3.5) return 'Ispod prosjeka';
  return 'Slabo';
}

function scoreLabelBg(v: number | null): string {
  if (v === null) return '';
  if (v >= 8)   return 'bg-emerald-50 text-emerald-700';
  if (v >= 6.5) return 'bg-green-50 text-green-700';
  if (v >= 5)   return 'bg-amber-50 text-amber-700';
  if (v >= 3.5) return 'bg-orange-50 text-orange-700';
  return 'bg-red-50 text-red-700';
}

function scoreGradient(v: number | null): string {
  if (v === null) return '#e5e7eb';
  if (v >= 8)   return 'linear-gradient(90deg, #10b981 0%, #10b981 100%)';
  if (v >= 6.5) return 'linear-gradient(90deg, #10b981 0%, #4ade80 100%)';
  if (v >= 5)   return 'linear-gradient(90deg, #10b981 0%, #f59e0b 100%)';
  if (v >= 3.5) return 'linear-gradient(90deg, #f59e0b 0%, #f97316 100%)';
  return 'linear-gradient(90deg, #f97316 0%, #ef4444 100%)';
}

// Auto-generirani sažetak ključnih uvida dionice
function generateQuickAssessment(
  stock: Stock,
  scores: Scores,
  zseMedians: Record<string, number | null>,
  financials: StockFinancials[],
): string[] {
  const insights: string[] = [];

  // Valuacija
  if (stock.pb_ratio !== null && stock.pb_ratio < 1)
    insights.push(`Trguje ispod knjigovodstvene vrijednosti (P/B ${stock.pb_ratio.toFixed(2)}x)`);
  if (stock.pe_ratio !== null && zseMedians.pe_ratio !== null && stock.pe_ratio < zseMedians.pe_ratio)
    insights.push(`Valuacijski povoljno — P/E ${stock.pe_ratio.toFixed(1)}x ispod ZSE medijana (${zseMedians.pe_ratio.toFixed(1)}x)`);
  else if (stock.pe_ratio !== null && zseMedians.pe_ratio !== null && stock.pe_ratio > zseMedians.pe_ratio * 1.5)
    insights.push(`Relativno skupo — P/E ${stock.pe_ratio.toFixed(1)}x znatno iznad ZSE medijana (${zseMedians.pe_ratio.toFixed(1)}x)`);

  // Profitabilnost — trend neto marže
  if (financials.length >= 2) {
    const last = financials[financials.length - 1];
    const prev = financials[financials.length - 2];
    if (last.net_margin !== null && prev.net_margin !== null) {
      const pp = last.net_margin - prev.net_margin;
      if (Math.abs(pp) >= 2) {
        const dir = pp > 0 ? 'oporavila' : 'pala';
        insights.push(`Profitabilnost se ${dir} u ${last.year} (neto marža ${pp > 0 ? '+' : ''}${pp.toFixed(1)}pp na ${last.net_margin.toFixed(1)}%)`);
      }
    }
  }

  // Dividenda
  if (stock.dividend_yield !== null && stock.dividend_yield >= 4)
    insights.push(`Visok prinos od dividende: ${stock.dividend_yield.toFixed(2)}%`);

  // Financijsko zdravlje — zaduženost
  if (stock.current_ratio !== null && stock.current_ratio < 1)
    insights.push(`Tekuća likvidnost ispod 1.0x (${stock.current_ratio.toFixed(2)}x) — povišeni kratkoročni rizik`);

  // Score summary
  if (scores.overall !== null) {
    const lbl = scores.overall >= 7 ? 'nadprosječan' : scores.overall >= 5 ? 'prosječan' : 'ispodprosječan';
    insights.push(`Kompozitni score: ${scores.overall.toFixed(1)}/10 — ${lbl} u usporedbi s tržištem`);
  }

  return insights;
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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-gray-700 font-medium">{label}</span>
          {tip && <span className="text-[10px] text-gray-400 hidden sm:block">{tip}</span>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {value !== null && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${scoreLabelBg(value)}`}>
              {scoreLabel(value)}
            </span>
          )}
          <span className={`font-bold tabular-nums ${scoreColor(value)}`}>
            {value !== null ? `${value.toFixed(1)}/10` : '—'}
          </span>
        </div>
      </div>
      <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: scoreGradient(value) }}
        />
        {[25, 50, 75].map(pos => (
          <div key={pos} className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: `${pos}%` }} />
        ))}
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
  stock, financials, scores, sector, similarStocks, zseMedians, sectorMedians, description, sifSim,
}: Props) {
  const [chartView, setChartView] = useState<'revenue' | 'profitability' | 'cashflow'>('revenue');
  const [tableTab, setTableTab] = useState<'rdg' | 'bilanca' | 'cf'>('rdg');

  const years = financials.map(f => f.year);
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
      label: 'P/E',      dbKey: 'pe_ratio',
      value: stock.pe_ratio,      unit: 'x',
      median: zseMedians.pe_ratio, lowerIsBetter: true,
      description: 'Cijena / Zarada po dionici',
    },
    {
      label: 'P/B',      dbKey: 'pb_ratio',
      value: stock.pb_ratio,      unit: 'x',
      median: zseMedians.pb_ratio, lowerIsBetter: true,
      description: 'Cijena / Knjigovodstvena vrijednost',
    },
    {
      label: 'EV/EBITDA', dbKey: 'ev_ebitda',
      value: stock.ev_ebitda,     unit: 'x',
      median: zseMedians.ev_ebitda, lowerIsBetter: true,
      description: 'Vrijednost poduzeća / EBITDA',
    },
    {
      label: 'P/S',      dbKey: 'ps_ratio',
      value: stock.ps_ratio,      unit: 'x',
      median: zseMedians.ps_ratio, lowerIsBetter: true,
      description: 'Cijena / Prihod po dionici',
    },
    {
      label: 'P/FCF',    dbKey: 'pfcf_ratio',
      value: stock.pfcf_ratio,    unit: 'x',
      median: zseMedians.pfcf_ratio, lowerIsBetter: true,
      description: 'Cijena / Slobodni novčani tok po dionici',
    },
    {
      label: 'Prinos od zarade', dbKey: 'earnings_yield',
      value: stock.earnings_yield, unit: '%',
      median: zseMedians.earnings_yield, lowerIsBetter: false,
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

  const highlightRows: Record<string, string[]> = {
    rdg:     ['Prihod', 'Neto dobit', 'EPS'],
    bilanca: ['Ukupna aktiva', 'Kapital'],
    cf:      ['Operativni CF', 'Slobodni CF (FCF)'],
  };

  const mojeUrl = `https://www.mojedionice.com/dionica/${sifSim}`;

  // Per-share metrics (computed)
  const revenuePerShare = stock.revenue !== null && stock.shares_outstanding !== null && stock.shares_outstanding > 0
    ? stock.revenue / stock.shares_outstanding : null;
  const fcfPerShare = stock.free_cash_flow !== null && stock.shares_outstanding !== null && stock.shares_outstanding > 0
    ? stock.free_cash_flow / stock.shares_outstanding : null;

  // Dug / financijsko zdravlje (computed from balance sheet)
  const totalDebt = (stock.long_term_liabilities ?? 0) + (stock.current_liabilities ?? 0);
  const netDebt = totalDebt - (stock.cash ?? 0);
  const debtToEquity = stock.equity !== null && stock.equity > 0 ? totalDebt / stock.equity : null;
  const netDebtToEbitda = stock.ebitda !== null && stock.ebitda > 0 ? netDebt / stock.ebitda : null;

  // Enterprise Value (aproksimacija: market_cap + dugoročni dug - gotovina)
  const evApprox = stock.market_cap !== null
    ? stock.market_cap + (stock.long_term_liabilities ?? 0) - (stock.cash ?? 0)
    : null;

  // Brza procjena
  const quickInsights = generateQuickAssessment(stock, scores, zseMedians, financials);

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
            <p className="text-xs text-gray-400 mt-1">
              Zadnje ažurirano: {new Date(stock.last_updated).toLocaleDateString('hr-HR')}
            </p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Tržišna kap.', value: fmt(stock.market_cap), suffix: stock.currency },
            { label: 'Div. prinos',  value: stock.dividend_yield !== null ? stock.dividend_yield.toFixed(2) : '—', suffix: '%' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-3.5 shadow-sm">
              <p className="text-[11px] text-gray-400 mb-1">{stat.label}</p>
              <p className="text-lg font-bold tabular-nums text-gray-900">
                {stat.value}
                <span className="text-sm font-normal text-gray-400 ml-0.5">{stat.suffix}</span>
              </p>
            </div>
          ))}

          {/* Score card — semi-circle gauge */}
          <div className="bg-white rounded-xl border border-gray-100 p-3.5 shadow-sm">
            <p className="text-[11px] text-gray-400 mb-1">Score</p>
            <div className="flex items-center gap-2">
              <p className={`text-lg font-bold tabular-nums ${scoreColor(scores.overall)}`}>
                {scores.overall !== null ? scores.overall.toFixed(1) : '—'}
                <span className="text-sm font-normal text-gray-400 ml-0.5">/ 10</span>
              </p>
            </div>
            <div className="mt-1">
              <svg viewBox="0 0 100 50" className="w-full h-7">
                <path d="M 10 45 A 40 40 0 0 1 90 45" fill="none" stroke="#f3f4f6" strokeWidth="6" strokeLinecap="round" />
                {scores.overall !== null && (
                  <>
                    <path
                      d="M 10 45 A 40 40 0 0 1 90 45"
                      fill="none"
                      stroke={scores.overall >= 7 ? '#10b981' : scores.overall >= 4 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${(scores.overall / 10) * 126} 126`}
                    />
                    {(() => {
                      const angle = Math.PI - (scores.overall / 10) * Math.PI;
                      const x = 50 + 40 * Math.cos(angle);
                      const y = 45 - 40 * Math.sin(angle);
                      return (
                        <circle
                          cx={x} cy={y} r="3"
                          fill="white"
                          stroke={scores.overall >= 7 ? '#10b981' : scores.overall >= 4 ? '#f59e0b' : '#ef4444'}
                          strokeWidth="2"
                        />
                      );
                    })()}
                  </>
                )}
              </svg>
            </div>
          </div>

          {[
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

      {/* ── 2. OPIS TVRTKE + BRZA PROCJENA ── */}
      {(description || quickInsights.length > 0) && (
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            {description && (
              <p className="text-sm text-gray-600 leading-relaxed mb-4">{description}</p>
            )}
            {quickInsights.length > 0 && (
              <div className="border-t border-gray-50 pt-4">
                <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-2">Ključni uvidi</p>
                <ul className="space-y-1.5">
                  {quickInsights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── 3. KOMPOZITNI SCORE ── */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-4">
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

      {/* ── 4. VALUACIJA ── */}
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
                <p className="text-2xl font-bold text-gray-900 mb-3 tabular-nums">
                  {valStr}
                </p>
                {/* Horizontal gauge bar */}
                {m.value !== null && m.median !== null && (() => {
                  const maxRange = m.median * 2.5;
                  const position = Math.min(Math.max((m.value / maxRange) * 100, 2), 98);
                  const medianPosition = (m.median / maxRange) * 100;
                  return (
                    <div className="relative h-6 mb-1">
                      <div className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 bg-gray-100 rounded-full" />
                      <div className={`absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full w-full ${
                        m.lowerIsBetter
                          ? 'bg-gradient-to-r from-emerald-200 via-amber-100 to-red-200'
                          : 'bg-gradient-to-r from-red-200 via-amber-100 to-emerald-200'
                      }`} />
                      <div className="absolute top-0 bottom-0 w-px bg-gray-400" style={{ left: `${medianPosition}%` }}>
                        <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-gray-400 rounded-full" />
                      </div>
                      <div
                        className={`absolute top-1/2 w-3 h-3 rounded-full border-2 border-white shadow-md ${
                          isFavorable ? 'bg-emerald-500' : 'bg-red-400'
                        }`}
                        style={{ left: `${position}%`, transform: 'translate(-50%, -50%)' }}
                      />
                    </div>
                  );
                })()}
                <div className="flex items-center justify-between text-xs mt-2">
                  <span className="text-gray-400">
                    ZSE: {medStr}
                    {(() => {
                      const sv = sectorMedians?.[m.dbKey];
                      if (sv == null) return null;
                      const svStr = m.unit === '%' ? fmtPct(sv) : fmtX(sv);
                      return <> · <span className="text-blue-400">Sektor: {svStr}</span></>;
                    })()}
                  </span>
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

        {/* EV raščlamba + per-share metrike */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          {/* Enterprise Value breakdown */}
          {evApprox !== null && (
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-sm text-gray-500 font-medium mb-3">Enterprise Value raščlamba</p>
              <div className="space-y-1.5 text-xs">
                {[
                  { label: 'Tržišna kapitalizacija', value: stock.market_cap, sign: '' },
                  { label: '+ Dugoročne obveze', value: stock.long_term_liabilities, sign: '+' },
                  { label: '− Gotovina', value: stock.cash, sign: '−' },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between text-gray-600">
                    <span>{row.label}</span>
                    <span className="tabular-nums font-medium">{row.value !== null ? fmt(row.value) : '—'} {stock.currency}</span>
                  </div>
                ))}
                <div className="border-t border-gray-100 pt-1.5 flex items-center justify-between font-semibold text-gray-900">
                  <span>= Enterprise Value</span>
                  <span className="tabular-nums">{fmt(evApprox)} {stock.currency}</span>
                </div>
                {stock.ev_ebitda !== null && (
                  <div className="flex items-center justify-between text-gray-400 text-[11px] pt-0.5">
                    <span>EV/EBITDA</span>
                    <span className="tabular-nums font-medium text-gray-700">{fmtX(stock.ev_ebitda)}</span>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-gray-300 mt-2">* Aproksimacija: ne uključuje kratkoročne financijske obveze</p>
            </div>
          )}

          {/* Per-share metrike */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-sm text-gray-500 font-medium mb-3">Po dionici</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'EPS', value: stock.eps, suffix: stock.currency },
                { label: 'Knjigovodstvena v.', value: stock.book_value_per_share, suffix: stock.currency },
                { label: 'Prihod / dionica', value: revenuePerShare, suffix: stock.currency },
                { label: 'FCF / dionica', value: fcfPerShare, suffix: stock.currency },
                { label: 'Dividenda', value: stock.dividend, suffix: stock.currency },
              ].map(item => (
                <div key={item.label}>
                  <span className="text-[10px] text-gray-400 block">{item.label}</span>
                  <span className="text-sm font-medium tabular-nums text-gray-700">
                    {item.value !== null && item.value !== undefined ? item.value.toFixed(2) : '—'}
                    <span className="text-[10px] text-gray-400 ml-0.5">{item.suffix}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. PROFITABILNOST ── */}

      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Profitabilnost</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {profMetrics.map((m) => {
            const histVals = financials.map(f => f[m.key] as number | null);
            const validHist = histVals.filter((v): v is number => v !== null);
            const ppChange = validHist.length >= 2
              ? validHist[validHist.length - 1] - validHist[validHist.length - 2]
              : null;
            return (
              <div key={m.label} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm text-gray-500 font-medium">{m.label}</p>
                  <span className="text-[10px] text-gray-400">{m.description}</span>
                </div>
                {/* Value + pp change badge */}
                <div className="flex items-baseline gap-2 mb-3">
                  <p className="text-2xl font-bold text-gray-900 tabular-nums">
                    {m.value !== null ? `${m.value.toFixed(2)}%` : '—'}
                  </p>
                  {ppChange !== null && (
                    <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-md ${
                      ppChange >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'
                    }`}>
                      <svg className={`w-3 h-3 flex-shrink-0 ${ppChange < 0 ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="currentColor">
                        <path d="M6 2L10 7H2L6 2Z" />
                      </svg>
                      {ppChange >= 0 ? '+' : ''}{ppChange.toFixed(1)}pp
                    </span>
                  )}
                </div>
                {/* Sparkline + year list */}
                {financials.length > 0 && (
                  <div className="flex items-center gap-3 border-t border-gray-50 pt-3">
                    <div className="w-16 flex-shrink-0">
                      <Sparkline values={histVals} color={ppChange !== null && ppChange < 0 ? '#ef4444' : '#10b981'} />
                    </div>
                    <div className="flex-1 space-y-1">
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
                  </div>
                )}
                {m.median !== null && m.value !== null && (
                  <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-gray-50">
                    <span className="text-gray-400">
                      ZSE: {m.median.toFixed(1)}%
                      {(() => {
                        const sv = sectorMedians?.[m.key as string];
                        if (sv == null) return null;
                        return <span> · <span className="text-blue-400">Sektor: {sv.toFixed(1)}%</span></span>;
                      })()}
                    </span>
                    <span className={m.value > m.median ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
                      {m.value > m.median ? '✓ Iznad' : '▼ Ispod'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
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

            {/* Custom legend for revenue chart */}
            {chartView === 'revenue' && (
              <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-200 flex-shrink-0" />
                  <span>Prihod (lijeva os)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-blue-500 flex-shrink-0" />
                  <span>EBITDA (desna os)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-0.5 bg-emerald-500 rounded flex-shrink-0" />
                  <span>Neto dobit (desna os)</span>
                </div>
              </div>
            )}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                {chartView === 'revenue' ? (
                  <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={fmtLarge} width={55} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={fmtLarge} width={55} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v, name) => [typeof v === 'number' ? fmtLarge(v) : String(v ?? ''), name]}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontSize: '12px' }}
                    />
                    <Bar yAxisId="left"  dataKey="prihod"    name="Prihod"     fill="#dbeafe" stroke="#93c5fd" strokeWidth={1} radius={[3,3,0,0]} barSize={60} />
                    <Bar yAxisId="right" dataKey="ebitda"    name="EBITDA"     fill="#3b82f6" radius={[3,3,0,0]} barSize={30} />
                    <Line yAxisId="right" dataKey="netoDobit" name="Neto dobit" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981', stroke: 'white', strokeWidth: 2 }} />
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
                    const isHighlight = highlightRows[tableTab]?.includes(row.label) ?? false;
                    return (
                      <tr key={row.label + idx} className={`hover:bg-blue-50/30 transition-colors ${isHighlight ? 'bg-blue-50/40' : ''}`}>
                        <td className={`text-xs py-2.5 px-5 sticky left-0 ${isHighlight ? 'bg-blue-50/40 font-semibold text-gray-900' : `bg-white ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}`}>
                          {row.label}
                        </td>
                        {row.values.map((v, vi) => (
                          <td key={vi} className={`text-xs text-right py-2.5 px-4 tabular-nums ${v !== null && v < 0 ? 'text-red-500' : 'text-gray-700'} ${row.bold || isHighlight ? 'font-semibold' : ''}`}>
                            {formatCell(v, row.format)}
                          </td>
                        ))}
                        {nYears > 0 && (
                          <td className="text-xs text-right py-2.5 px-4 tabular-nums border-l border-gray-50">
                            {cagrVal !== null ? (
                              <span className={`inline-flex items-center gap-0.5 font-medium ${cagrVal >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                <svg className={`w-2.5 h-2.5 flex-shrink-0 ${cagrVal < 0 ? 'rotate-180' : ''}`} viewBox="0 0 10 10" fill="currentColor">
                                  <path d="M5 1L9 7H1L5 1Z" />
                                </svg>
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

      {/* ── 8. DUG I FINANCIJSKO ZDRAVLJE ── */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Dug i financijsko zdravlje</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: 'Neto dug',
              value: fmt(netDebt),
              suffix: stock.currency,
              color: netDebt > 0 ? 'text-red-500' : 'text-emerald-600',
              tip: 'Ukupni dug − gotovina',
            },
            {
              label: 'Dug / Kapital',
              value: debtToEquity !== null ? debtToEquity.toFixed(2) : '—',
              suffix: 'x',
              color: debtToEquity !== null && debtToEquity > 2 ? 'text-red-500' : debtToEquity !== null && debtToEquity > 1 ? 'text-amber-500' : 'text-emerald-600',
              tip: 'Ukupne obveze / Kapital',
            },
            {
              label: 'Neto dug / EBITDA',
              value: netDebtToEbitda !== null ? netDebtToEbitda.toFixed(2) : '—',
              suffix: 'x',
              color: netDebtToEbitda !== null && netDebtToEbitda > 3 ? 'text-red-500' : netDebtToEbitda !== null && netDebtToEbitda > 1.5 ? 'text-amber-500' : 'text-emerald-600',
              tip: 'Neto dug / EBITDA',
            },
            {
              label: 'Tekuća likvidnost',
              value: stock.current_ratio !== null ? stock.current_ratio.toFixed(2) : '—',
              suffix: 'x',
              color: stock.current_ratio !== null && stock.current_ratio < 1 ? 'text-red-500' : stock.current_ratio !== null && stock.current_ratio < 1.5 ? 'text-amber-500' : 'text-emerald-600',
              tip: 'Kratk. imovina / Kratk. obveze',
            },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-3.5 shadow-sm">
              <p className="text-[11px] text-gray-400 mb-0.5">{stat.label}</p>
              <p className={`text-lg font-bold tabular-nums ${stat.color}`}>
                {stat.value}
                <span className="text-sm font-normal text-gray-400 ml-0.5">{stat.suffix}</span>
              </p>
              <p className="text-[10px] text-gray-300 mt-0.5">{stat.tip}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 9. SLIČNE DIONICE ── */}
      {similarStocks.length > 0 && (
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Slične dionice</h2>
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {similarStocks.map((s) => (
              <Link
                key={s.ticker}
                href={`/dionica/${s.ticker}`}
                className="flex-shrink-0 bg-white rounded-xl border border-gray-100 shadow-sm p-4 w-52 hover:border-blue-200 hover:shadow-md transition-all"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-semibold text-gray-700">{s.ticker}</span>
                  {s.dividend_yield !== null && s.dividend_yield > 0 && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                      Div {s.dividend_yield.toFixed(1)}%
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500 block mb-2 truncate leading-tight">{s.name}</span>
                <span className="text-base font-bold text-gray-900 tabular-nums block mb-3">
                  {s.price !== null ? s.price.toFixed(0) : '—'}
                  <span className="text-xs font-normal text-gray-400 ml-0.5">{s.currency}</span>
                </span>
                {/* 2x2 metric grid */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-gray-50 pt-2">
                  {s.pe_ratio !== null && (
                    <div>
                      <span className="text-[10px] text-gray-400 block">P/E</span>
                      <span className="text-xs font-medium tabular-nums text-gray-700">{s.pe_ratio.toFixed(1)}x</span>
                    </div>
                  )}
                  {s.roe !== null && (
                    <div>
                      <span className="text-[10px] text-gray-400 block">ROE</span>
                      <span className="text-xs font-medium tabular-nums text-gray-700">{s.roe.toFixed(1)}%</span>
                    </div>
                  )}
                  {s.net_margin !== null && (
                    <div>
                      <span className="text-[10px] text-gray-400 block">Marža</span>
                      <span className="text-xs font-medium tabular-nums text-gray-700">{s.net_margin.toFixed(1)}%</span>
                    </div>
                  )}
                  {s.ev_ebitda !== null && (
                    <div>
                      <span className="text-[10px] text-gray-400 block">EV/EBITDA</span>
                      <span className="text-xs font-medium tabular-nums text-gray-700">{s.ev_ebitda.toFixed(1)}x</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
