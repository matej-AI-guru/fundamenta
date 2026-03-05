'use client';

import { useMemo, useState, useEffect } from 'react';
import type { Stock, FilterValues } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────
type Color = 'green' | 'blue' | 'amber' | 'teal' | 'purple' | 'yellow';

interface Strategy {
  id: string;
  name: string;
  description: string;
  color: Color;
  icon: React.ReactNode;
  filters: Partial<FilterValues>;
  tags: string[];
}

// ── Color config (full class strings for Tailwind detection) ──────────────────
const COLOR: Record<Color, { iconWrap: string; iconText: string; activeCard: string; btn: string }> = {
  green:  { iconWrap: 'bg-green-50',  iconText: 'text-green-600',  activeCard: 'border-green-300 bg-green-50/50',  btn: 'text-green-700 border-green-200 hover:bg-green-50 hover:border-green-300'  },
  blue:   { iconWrap: 'bg-blue-50',   iconText: 'text-blue-600',   activeCard: 'border-blue-300 bg-blue-50/50',    btn: 'text-blue-700 border-blue-200 hover:bg-blue-50 hover:border-blue-300'    },
  amber:  { iconWrap: 'bg-amber-50',  iconText: 'text-amber-600',  activeCard: 'border-amber-300 bg-amber-50/50',  btn: 'text-amber-700 border-amber-200 hover:bg-amber-50 hover:border-amber-300'  },
  teal:   { iconWrap: 'bg-teal-50',   iconText: 'text-teal-600',   activeCard: 'border-teal-300 bg-teal-50/50',    btn: 'text-teal-700 border-teal-200 hover:bg-teal-50 hover:border-teal-300'    },
  purple: { iconWrap: 'bg-purple-50', iconText: 'text-purple-600', activeCard: 'border-purple-300 bg-purple-50/50',btn: 'text-purple-700 border-purple-200 hover:bg-purple-50 hover:border-purple-300'},
  yellow: { iconWrap: 'bg-yellow-50', iconText: 'text-yellow-600', activeCard: 'border-yellow-300 bg-yellow-50/50',btn: 'text-yellow-700 border-yellow-200 hover:bg-yellow-50 hover:border-yellow-300'},
};

// ── Icons (inline SVG, Lucide-style) ─────────────────────────────────────────
const TrendingUp = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);
const Star = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const Scale = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z" />
    <path d="M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z" />
    <path d="M7 21h10" />
    <line x1="12" y1="21" x2="12" y2="3" />
    <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
  </svg>
);
const BarChart = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);
const Coins = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <circle cx="8" cy="8" r="6" />
    <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
    <path d="M7 6h1v4" />
  </svg>
);
const Droplets = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
  </svg>
);
const Target = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

// ── Strategy definitions ──────────────────────────────────────────────────────
const STRATEGIES: Strategy[] = [
  {
    id: 'buffett',
    name: 'Buffett podcijenjenost',
    description: 'Buffettova vrijednost premašuje tržišnu kap. za >20% uz pristojan povrat na kapital.',
    color: 'green',
    icon: <TrendingUp />,
    filters: { buffett_undervalue_min: 0.20, roce_min: 10 },
    tags: ['Buffett >20%', 'ROCE >10%'],
  },
  {
    id: 'quality-growth',
    name: 'Kvalitetni rast',
    description: 'Profitabilne tvrtke s visokim povratom na kapital i fer valuacijom.',
    color: 'blue',
    icon: <Star />,
    filters: { roce_min: 15, roe_min: 12, net_margin_min: 8, pe_max: 25 },
    tags: ['ROCE >15%', 'ROE >12%', 'Marža >8%', 'P/E <25x'],
  },
  {
    id: 'deep-value',
    name: 'Duboka vrijednost',
    description: 'Dionice ispod fer vrijednosti — klasični Grahamov pristup.',
    color: 'amber',
    icon: <Scale />,
    filters: { pe_max: 10, pb_max: 1.2, ev_ebitda_max: 6, current_ratio_min: 1.5 },
    tags: ['P/E <10x', 'P/B <1.2x', 'EV/EBITDA <6x'],
  },
  {
    id: 'high-roce',
    name: 'Visoki ROCE',
    description: 'Tvrtke koje svaki euro kapitala pretvaraju u visok povrat — znak kvalitete.',
    color: 'green',
    icon: <BarChart />,
    filters: { roce_min: 15 },
    tags: ['ROCE >15%'],
  },
  {
    id: 'dividende',
    name: 'Dividendne dionice',
    description: 'Dionice s redovitom dividendom za stabilan pasivni prihod.',
    color: 'yellow',
    icon: <Coins />,
    filters: { dividend_yield_min: 3, pe_max: 20, net_margin_min: 5, current_ratio_min: 1.0 },
    tags: ['Div. prinos >3%', 'P/E <20x', 'Marža >5%'],
  },
  {
    id: 'fcf-machine',
    name: 'FCF stroj',
    description: 'Tvrtke koje generiraju pravi novac — P/FCF < 15x uz pozitivan slobodni tok.',
    color: 'teal',
    icon: <Droplets />,
    filters: { pfcf_max: 15, free_cash_flow_min: 0, net_margin_min: 5 },
    tags: ['P/FCF <15x', 'FCF >0', 'Marža >5%'],
  },
  {
    id: 'small-cap',
    name: 'Mala i podcijenjena',
    description: 'Male kompanije koje fondovi ignoriraju — alfa prilike na ZSE-u.',
    color: 'purple',
    icon: <Target />,
    filters: { market_cap_max: 100_000_000, pe_max: 15, ev_ebitda_max: 8, revenue_min: 10_000_000 },
    tags: ['Kap. <100M', 'P/E <15x', 'EV/EBITDA <8x'],
  },
];

// ── Client-side matching for live counts ──────────────────────────────────────
function clientMatch(s: Stock, f: Partial<FilterValues>): boolean {
  if (f.pe_max != null && (s.pe_ratio == null || s.pe_ratio <= 0 || s.pe_ratio > f.pe_max)) return false;
  if (f.pb_max != null && (s.pb_ratio == null || s.pb_ratio > f.pb_max)) return false;
  if (f.ev_ebitda_max != null && (s.ev_ebitda == null || s.ev_ebitda > f.ev_ebitda_max)) return false;
  if (f.roce_min != null && (s.roce == null || s.roce < f.roce_min)) return false;
  if (f.roe_min != null && (s.roe == null || s.roe < f.roe_min)) return false;
  if (f.net_margin_min != null && (s.net_margin == null || s.net_margin < f.net_margin_min)) return false;
  if (f.buffett_undervalue_min != null && (s.buffett_undervalue == null || s.buffett_undervalue < f.buffett_undervalue_min)) return false;
  if (f.current_ratio_min != null && (s.current_ratio == null || s.current_ratio < f.current_ratio_min)) return false;
  if (f.dividend_yield_min != null && (s.dividend_yield == null || s.dividend_yield < f.dividend_yield_min)) return false;
  if (f.pfcf_max != null && (s.pfcf_ratio == null || s.pfcf_ratio <= 0 || s.pfcf_ratio > f.pfcf_max)) return false;
  if (f.free_cash_flow_min != null && (s.free_cash_flow == null || s.free_cash_flow < f.free_cash_flow_min)) return false;
  if (f.market_cap_max != null && (s.market_cap == null || s.market_cap > f.market_cap_max)) return false;
  if (f.revenue_min != null && (s.revenue == null || s.revenue < f.revenue_min)) return false;
  return true;
}

function countLabel(n: number): string {
  if (n === 1) return '1 dionica';
  if (n >= 2 && n <= 4) return `${n} dionice`;
  return `${n} dionica`;
}

// ── Component ─────────────────────────────────────────────────────────────────
interface StrategyCardsProps {
  allStocks: Stock[];
  filters: Partial<FilterValues>;
  onChange: (f: Partial<FilterValues>) => void;
}

export default function StrategyCards({ allStocks, filters, onChange }: StrategyCardsProps) {
  const [activeStrategyId, setActiveStrategyId] = useState<string | null>(null);

  // Auto-clear activeStrategyId if filters were changed externally (e.g., FilterPanel)
  useEffect(() => {
    if (activeStrategyId === null) return;
    const strat = STRATEGIES.find(s => s.id === activeStrategyId);
    if (!strat) return;
    const allMatch = Object.entries(strat.filters).every(
      ([k, v]) => filters[k as keyof FilterValues] === v
    );
    if (!allMatch) setActiveStrategyId(null);
  }, [filters, activeStrategyId]);

  const counts = useMemo(
    () => new Map(STRATEGIES.map(s => [s.id, allStocks.filter(st => clientMatch(st, s.filters)).length])),
    [allStocks]
  );

  return (
    <div className="flex-shrink-0 mb-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2.5">
        Strategije ulaganja
      </p>
      {/* Horizontal scroll with right-fade hint */}
      <div className="relative">
        <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {STRATEGIES.map(strategy => {
            const active = strategy.id === activeStrategyId;
            const count = counts.get(strategy.id) ?? 0;
            const c = COLOR[strategy.color];

            const handleClick = () => {
              if (active) {
                setActiveStrategyId(null);
                onChange({});
              } else {
                setActiveStrategyId(strategy.id);
                onChange({ ...strategy.filters });
              }
            };

            return (
              <div
                key={strategy.id}
                onClick={handleClick}
                className={`group flex-shrink-0 w-48 p-3.5 bg-white rounded-xl border shadow-sm
                            hover:shadow-md cursor-pointer transition-all flex flex-col
                            ${active ? c.activeCard : 'border-gray-100 hover:border-gray-200'}`}
              >
                {/* Header: icon + name + count */}
                <div className="flex items-start gap-2.5 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${c.iconWrap} ${c.iconText}`}>
                    {strategy.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-900 leading-tight">{strategy.name}</p>
                    <p className={`text-[10px] mt-0.5 font-medium tabular-nums ${count > 0 ? 'text-gray-400' : 'text-gray-300'}`}>
                      {countLabel(count)}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[11px] text-gray-500 leading-relaxed mb-2.5">
                  {strategy.description}
                </p>

                {/* Filter tags */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {strategy.tags.map(tag => (
                    <span
                      key={tag}
                      className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* CTA */}
                <button
                  className={`mt-auto w-full text-[11px] font-semibold border rounded-lg py-1.5 transition-all ${
                    active
                      ? 'bg-gray-900 text-white border-gray-900'
                      : `${c.btn}`
                  }`}
                  onClick={e => {
                    e.stopPropagation();
                    handleClick();
                  }}
                >
                  {active ? '✓ Aktivno — poništi' : 'Primijeni →'}
                </button>
              </div>
            );
          })}
        </div>
        {/* Right-edge fade hint (indicates more cards) */}
        <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-slate-100 to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
