'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { PriceHistory } from '@/lib/supabase';

type Period = '1M' | '3M' | '6M' | '1G' | '3G' | '5G' | 'Max';
const PERIODS: Period[] = ['1M', '3M', '6M', '1G', '3G', '5G', 'Max'];

function cutoffDate(period: Period): Date | null {
  if (period === 'Max') return null;
  const d = new Date();
  if (period === '1M') d.setMonth(d.getMonth() - 1);
  else if (period === '3M') d.setMonth(d.getMonth() - 3);
  else if (period === '6M') d.setMonth(d.getMonth() - 6);
  else if (period === '1G') d.setFullYear(d.getFullYear() - 1);
  else if (period === '3G') d.setFullYear(d.getFullYear() - 3);
  else if (period === '5G') d.setFullYear(d.getFullYear() - 5);
  return d;
}

interface Props {
  history: PriceHistory[];
  currency: string;
}

export default function PriceChart({ history, currency }: Props) {
  const [period, setPeriod] = useState<Period>('1G');

  const filtered = useMemo(() => {
    const cutoff = cutoffDate(period);
    if (!cutoff) return history;
    return history.filter(d => new Date(d.date) >= cutoff);
  }, [history, period]);

  const hasData = filtered.length >= 2;
  const first = hasData ? filtered[0].price : null;
  const last  = hasData ? filtered[filtered.length - 1].price : null;
  const change = first && last ? ((last - first) / first) * 100 : null;
  const isPositive = change === null || change >= 0;
  const strokeColor = isPositive ? '#10b981' : '#ef4444';

  const minP = hasData ? Math.min(...filtered.map(d => d.price)) : 0;
  const maxP = hasData ? Math.max(...filtered.map(d => d.price)) : 1;
  const yPad = (maxP - minP) * 0.1 || 1;

  const isPeriodAvailable = (p: Period) => {
    const cutoff = cutoffDate(p);
    if (!cutoff) return history.length >= 2;
    return history.filter(d => new Date(d.date) >= cutoff).length >= 2;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Kretanje cijene</h2>
          {change !== null && last !== null && (
            <p className={`text-sm font-medium mt-0.5 ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
              {last.toFixed(2)} {currency}
              <span className="ml-2 text-xs">
                {isPositive ? '+' : ''}{change.toFixed(2)}% (odabrano razdoblje)
              </span>
            </p>
          )}
        </div>
        <div className="flex gap-0.5 bg-gray-50 rounded-lg p-0.5 self-start sm:self-auto">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              disabled={!isPeriodAvailable(p)}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                period === p
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="h-48 flex items-center justify-center text-sm text-gray-400">
          Podaci o cijeni prikupljaju se dnevno — graf će biti dostupan za odabrano razdoblje
          nakon što se nakupi dovoljno podataka.
        </div>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filtered.map(d => ({ date: d.date, price: d.price }))}
              margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`priceGrad-${currency}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={strokeColor} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                tickFormatter={d => {
                  const date = new Date(d);
                  const showYear = period === 'Max' || period === '5G' || period === '3G';
                  return date.toLocaleDateString('hr-HR', {
                    month: 'short',
                    year: showYear ? '2-digit' : undefined,
                  });
                }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[minP - yPad, maxP + yPad]}
                tick={{ fontSize: 10 }}
                tickFormatter={v => v.toFixed(0)}
                width={50}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => [`${Number(v ?? 0).toFixed(2)} ${currency}`, 'Cijena']}
                labelFormatter={d => new Date(d as string).toLocaleDateString('hr-HR')}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontSize: '12px' }}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={strokeColor}
                strokeWidth={2}
                fill={`url(#priceGrad-${currency})`}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
