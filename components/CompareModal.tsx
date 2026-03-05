'use client';

import { Fragment } from 'react';
import type { Stock } from '@/lib/supabase';

// ─── Format helpers ─────────────────────────────────────────────────────────
function fmt(v: number | null): string {
  if (v === null || v === undefined) return '—';
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(2);
}
const fmtPct = (v: number | null) => (v !== null ? `${v.toFixed(2)}%` : '—');
const fmtX   = (v: number | null) => (v !== null ? `${v.toFixed(2)}x` : '—');

// ─── Metric definitions ──────────────────────────────────────────────────────
type MetricDef = {
  label: string;
  section?: string;
  getValue: (s: Stock, sm: Map<string, number | null>) => number | null;
  format: (v: number | null, s: Stock) => string;
  higherIsBetter?: boolean; // undefined = no highlight
  showBar?: boolean;
};

const METRICS: MetricDef[] = [
  // ── Tržišni podaci ──────────────────────────────────────────────────────
  {
    section: 'Tržišni podaci',
    label: 'Cijena',
    getValue: s => s.price,
    format: (v, s) => v !== null ? `${v.toFixed(2)} ${s.currency}` : '—',
  },
  { label: 'Tržišna kap.', getValue: s => s.market_cap, format: v => fmt(v) },

  // ── Valuacija ────────────────────────────────────────────────────────────
  {
    section: 'Valuacija',
    label: 'P/E',
    getValue: s => (s.pe_ratio !== null && s.pe_ratio > 0 ? s.pe_ratio : null),
    format: v => fmtX(v),
    higherIsBetter: false,
    showBar: true,
  },
  { label: 'EV/EBITDA', getValue: s => s.ev_ebitda, format: v => fmtX(v), higherIsBetter: false, showBar: true },
  { label: 'P/B',       getValue: s => s.pb_ratio,  format: v => fmtX(v), higherIsBetter: false, showBar: true },
  {
    label: 'Buffett podcijenjenost',
    getValue: s => s.buffett_undervalue !== null ? s.buffett_undervalue * 100 : null,
    format: v => fmtPct(v),
    higherIsBetter: true,
    showBar: true,
  },

  // ── Profitabilnost ───────────────────────────────────────────────────────
  { section: 'Profitabilnost', label: 'Neto marža', getValue: s => s.net_margin,    format: v => fmtPct(v), higherIsBetter: true, showBar: true },
  { label: 'ROE',               getValue: s => s.roe,         format: v => fmtPct(v), higherIsBetter: true, showBar: true },
  { label: 'ROCE',              getValue: s => s.roce,        format: v => fmtPct(v), higherIsBetter: true, showBar: true },

  // ── Bilanca i RDG ────────────────────────────────────────────────────────
  { section: 'Bilanca i RDG', label: 'Prihod',           getValue: s => s.revenue,         format: v => fmt(v), higherIsBetter: true },
  { label: 'EBITDA',                                        getValue: s => s.ebitda,          format: v => fmt(v), higherIsBetter: true },
  { label: 'EPS',                                           getValue: s => s.eps,             format: v => fmt(v), higherIsBetter: true, showBar: true },
  { label: 'FCF',                                           getValue: s => s.free_cash_flow,  format: v => fmt(v), higherIsBetter: true, showBar: true },
  { label: 'Tekuća likvidnost',                             getValue: s => s.current_ratio,   format: v => fmtX(v), higherIsBetter: true, showBar: true },

  // ── Score ────────────────────────────────────────────────────────────────
  {
    section: 'Score',
    label: 'Kompozitni score',
    getValue: (s, sm) => sm.get(s.ticker) ?? null,
    format: v => v !== null ? `${v.toFixed(1)} / 10` : '—',
    higherIsBetter: true,
    showBar: true,
  },
];

// ─── Component ───────────────────────────────────────────────────────────────
interface CompareModalProps {
  stocks: Stock[];
  scoreMap: Map<string, number | null>;
  onClose: () => void;
}

export default function CompareModal({ stocks, scoreMap, onClose }: CompareModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col w-full"
        style={{ maxWidth: '860px', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Usporedba dionica</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Najbolja vrijednost
              </span>
              {' · '}
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Najgora vrijednost
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-gray-100">
                <th
                  className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide sticky left-0 bg-white"
                  style={{ minWidth: '150px' }}
                >
                  Pokazatelj
                </th>
                {stocks.map(s => (
                  <th key={s.ticker} className="px-4 py-3 text-center" style={{ minWidth: '130px' }}>
                    <div className="flex flex-col items-center gap-1">
                      <span className="inline-block text-[11px] font-mono font-medium px-1.5 py-0.5 rounded-md border border-gray-200 text-gray-700 tracking-wide">
                        {s.ticker}
                      </span>
                      <span className="text-xs text-gray-500 font-normal max-w-[120px] truncate">{s.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {METRICS.map((metric, i) => {
                const rawValues = stocks.map(s => metric.getValue(s, scoreMap));
                const validValues = rawValues.filter((v): v is number => v !== null);

                // Best / worst highlighting
                let bestVal: number | null = null;
                let worstVal: number | null = null;
                if (metric.higherIsBetter !== undefined && validValues.length >= 2) {
                  const best  = metric.higherIsBetter ? Math.max(...validValues) : Math.min(...validValues);
                  const worst = metric.higherIsBetter ? Math.min(...validValues) : Math.max(...validValues);
                  if (best !== worst) { bestVal = best; worstVal = worst; }
                }

                // Mini bars
                const showBars = metric.showBar === true && validValues.length >= 2;
                const minV  = showBars ? Math.min(...validValues) : 0;
                const maxV  = showBars ? Math.max(...validValues) : 1;
                const range = maxV - minV || 1;

                return (
                  <Fragment key={i}>
                    {/* Section header */}
                    {metric.section && (
                      <tr>
                        <td
                          colSpan={stocks.length + 1}
                          className="px-5 pt-4 pb-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-y border-gray-100"
                        >
                          {metric.section}
                        </td>
                      </tr>
                    )}

                    {/* Data row */}
                    <tr className="border-b border-gray-50">
                      <td className="px-5 py-3 text-xs font-medium text-gray-500 whitespace-nowrap sticky left-0 bg-white">
                        {metric.label}
                      </td>
                      {stocks.map((s, colIdx) => {
                        const val       = rawValues[colIdx];
                        const formatted = metric.format(val, s);
                        const isBest    = bestVal  !== null && val === bestVal;
                        const isWorst   = worstVal !== null && val === worstVal;

                        let barPct = 0;
                        if (showBars && val !== null) {
                          barPct = metric.higherIsBetter
                            ? Math.max(0, ((val - minV) / range) * 100)
                            : Math.max(0, ((maxV - val) / range) * 100);
                        }

                        return (
                          <td
                            key={s.ticker}
                            className={`px-4 py-2.5 text-center ${
                              isBest  ? 'bg-emerald-50' :
                              isWorst ? 'bg-orange-50'  :
                              ''
                            }`}
                          >
                            <div className="flex flex-col items-center gap-1.5">
                              {/* Value + icon */}
                              <span className={`text-sm font-medium inline-flex items-center gap-1 ${
                                isBest  ? 'text-emerald-700' :
                                isWorst ? 'text-amber-700'   :
                                'text-gray-700'
                              }`}>
                                {formatted}
                                {isBest && (
                                  <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                                {isWorst && (
                                  <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </span>

                              {/* Mini bar */}
                              {showBars && val !== null && (
                                <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      isBest  ? 'bg-emerald-400' :
                                      isWorst ? 'bg-amber-400'   :
                                      'bg-blue-300'
                                    }`}
                                    style={{ width: `${Math.max(4, barPct)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
