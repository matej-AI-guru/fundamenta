'use client';

import { useState } from 'react';
import RangeSlider from './RangeSlider';
import AlertSubscribe from './AlertSubscribe';
import type { FilterValues } from '@/lib/supabase';

interface FilterPanelProps {
  filters: Partial<FilterValues>;
  onChange: (filters: Partial<FilterValues>) => void;
  onReset: () => void;
  activeCount: number;
}

function fmt(v: number): string {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v % 1 === 0 ? String(v) : v.toFixed(2);
}
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtX = (v: number) => `${v.toFixed(1)}x`;

// Preset filter configurations
const PRESETS = [
  {
    label: 'Value dionice',
    desc: 'Nisko P/E i EV/EBITDA',
    filters: { pe_max: 15, ev_ebitda_max: 10 } as Partial<FilterValues>,
  },
  {
    label: 'Profitabilne',
    desc: 'Marža >10%, razumno vrednovane',
    filters: { net_margin_min: 10, ev_ebitda_max: 15 } as Partial<FilterValues>,
  },
];

export default function FilterPanel({ filters, onChange, onReset, activeCount }: FilterPanelProps) {
  const [showAdditional, setShowAdditional] = useState(false);

  const set = (key: keyof FilterValues, val: number | null) =>
    onChange({ ...filters, [key]: val });

  const setRange = (minKey: keyof FilterValues, maxKey: keyof FilterValues) =>
    ([min, max]: [number | null, number | null]) =>
      onChange({ ...filters, [minKey]: min, [maxKey]: max });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-shrink-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900">Filteri</h2>
          {activeCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
              {activeCount} aktivnih
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            onClick={onReset}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Resetiraj sve
          </button>
        )}
      </div>

      {/* Preset buttons */}
      <div className="px-6 py-4 border-b border-gray-100">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Gotovi odabiri</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => onChange({ ...preset.filters })}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 text-gray-600
                         hover:bg-blue-50 hover:text-blue-600 border border-gray-200
                         hover:border-blue-200 transition-all"
              title={preset.desc}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Primary filters */}
      <div className="px-6 py-5 space-y-7">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide -mb-2">
          Glavni pokazatelji
        </p>

        <RangeSlider
          label="P/E ratio"
          min={0}
          max={100}
          step={0.5}
          value={[filters.pe_min ?? null, filters.pe_max ?? null]}
          onChange={setRange('pe_min', 'pe_max')}
          formatValue={fmtX}
          description="Cijena / Zarada"
        />

        <RangeSlider
          label="P/B ratio"
          min={0}
          max={20}
          step={0.1}
          value={[filters.pb_min ?? null, filters.pb_max ?? null]}
          onChange={setRange('pb_min', 'pb_max')}
          formatValue={fmtX}
          description="Cijena / Knjigovodstvena vrijednost"
        />

        <RangeSlider
          label="EV / EBITDA (TTM)"
          min={0}
          max={50}
          step={0.1}
          value={[filters.ev_ebitda_min ?? null, filters.ev_ebitda_max ?? null]}
          onChange={setRange('ev_ebitda_min', 'ev_ebitda_max')}
          formatValue={fmtX}
          description="Poduzetnička vrijednost / EBITDA (TTM)"
        />
      </div>

      {/* Additional filters toggle */}
      <div className="px-6 pb-4">
        <button
          onClick={() => setShowAdditional((v) => !v)}
          className="w-full flex items-center justify-between py-3 px-4 rounded-xl
                     bg-gray-50 hover:bg-gray-100 transition-all border border-gray-100"
        >
          <span className="text-sm font-medium text-gray-600">Dodatni filteri</span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${showAdditional ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAdditional && (
          <div className="mt-5 space-y-7 pb-2">
            <RangeSlider
              label="Neto marža"
              unit="%"
              min={-100}
              max={100}
              step={0.5}
              value={[filters.net_margin_min ?? null, filters.net_margin_max ?? null]}
              onChange={setRange('net_margin_min', 'net_margin_max')}
              formatValue={fmtPct}
              description="Neto dobit / Prihod"
            />

            <RangeSlider
              label="Tržišna kapitalizacija"
              unit="EUR"
              min={0}
              max={2_000_000_000}
              step={1_000_000}
              value={[filters.market_cap_min ?? null, filters.market_cap_max ?? null]}
              onChange={setRange('market_cap_min', 'market_cap_max')}
              formatValue={fmt}
              description="Ukupna vrijednost tvrtke na burzi"
            />

            <RangeSlider
              label="Prihod (TTM)"
              unit="EUR"
              min={0}
              max={5_000_000_000}
              step={1_000_000}
              value={[filters.revenue_min ?? null, filters.revenue_max ?? null]}
              onChange={setRange('revenue_min', 'revenue_max')}
              formatValue={fmt}
              description="Godišnji prihod (trailing 12 mj.)"
            />

            <RangeSlider
              label="Neto dobit (TTM)"
              unit="EUR"
              min={-500_000_000}
              max={500_000_000}
              step={1_000_000}
              value={[filters.net_profit_min ?? null, filters.net_profit_max ?? null]}
              onChange={setRange('net_profit_min', 'net_profit_max')}
              formatValue={fmt}
              description="Godišnja neto dobit"
            />

            <RangeSlider
              label="P/S ratio"
              min={0}
              max={30}
              step={0.1}
              value={[filters.ps_min ?? null, filters.ps_max ?? null]}
              onChange={setRange('ps_min', 'ps_max')}
              formatValue={fmtX}
              description="Cijena / Prihod"
            />

            <RangeSlider
              label="P/CF ratio"
              min={0}
              max={50}
              step={0.5}
              value={[filters.pcf_min ?? null, filters.pcf_max ?? null]}
              onChange={setRange('pcf_min', 'pcf_max')}
              formatValue={fmtX}
              description="Cijena / Novčani tok"
            />

            <RangeSlider
              label="P/FCF ratio"
              min={0}
              max={100}
              step={0.5}
              value={[filters.pfcf_min ?? null, filters.pfcf_max ?? null]}
              onChange={setRange('pfcf_min', 'pfcf_max')}
              formatValue={fmtX}
              description="Cijena / Slobodni novčani tok"
            />

            <RangeSlider
              label="EPS (TTM)"
              unit="EUR"
              min={-50}
              max={200}
              step={0.1}
              value={[filters.eps_min ?? null, filters.eps_max ?? null]}
              onChange={setRange('eps_min', 'eps_max')}
              description="Dobit po dionici"
            />

            <RangeSlider
              label="ROE"
              unit="%"
              min={-50}
              max={100}
              step={0.5}
              value={[filters.roe_min ?? null, filters.roe_max ?? null]}
              onChange={setRange('roe_min', 'roe_max')}
              formatValue={fmtPct}
              description="Povrat na kapital (izračunato)"
            />

            <RangeSlider
              label="Prinos od zarade"
              unit="%"
              min={0}
              max={30}
              step={0.1}
              value={[filters.earnings_yield_min ?? null, filters.earnings_yield_max ?? null]}
              onChange={setRange('earnings_yield_min', 'earnings_yield_max')}
              formatValue={fmtPct}
              description="1/P/E — koliko zarađuješ za svaku kunu uloženu (izračunato)"
            />

            <RangeSlider
              label="Dionice u opticaju"
              min={0}
              max={100_000_000}
              step={10_000}
              value={[filters.shares_min ?? null, filters.shares_max ?? null]}
              onChange={setRange('shares_min', 'shares_max')}
              formatValue={fmt}
            />

          </div>
        )}
      </div>

      <AlertSubscribe filters={filters} />
    </div>
  );
}
