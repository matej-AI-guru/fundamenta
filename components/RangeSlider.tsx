'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface RangeSliderProps {
  label: string;
  unit?: string;
  min: number;
  max: number;
  step?: number;
  value: [number | null, number | null];
  onChange: (value: [number | null, number | null]) => void;
  formatValue?: (v: number) => string;
  logScale?: boolean;
  description?: string;
}

function formatDefault(v: number): string {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(2).replace(/\.00$/, '');
}

export default function RangeSlider({
  label,
  unit = '',
  min,
  max,
  step = 1,
  value,
  onChange,
  formatValue = formatDefault,
  description,
}: RangeSliderProps) {
  const [localMin, setLocalMin] = useState<string>(value[0] !== null ? String(value[0]) : '');
  const [localMax, setLocalMax] = useState<string>(value[1] !== null ? String(value[1]) : '');

  // Sync local state when value prop changes externally
  useEffect(() => {
    setLocalMin(value[0] !== null ? String(value[0]) : '');
    setLocalMax(value[1] !== null ? String(value[1]) : '');
  }, [value]);

  const sliderMin = value[0] ?? min;
  const sliderMax = value[1] ?? max;

  const pctMin = ((sliderMin - min) / (max - min)) * 100;
  const pctMax = ((sliderMax - min) / (max - min)) * 100;

  const isActive = value[0] !== null || value[1] !== null;

  const commitMin = useCallback(
    (raw: string) => {
      const n = parseFloat(raw);
      if (raw === '' || isNaN(n)) {
        onChange([null, value[1]]);
      } else {
        const clamped = Math.min(Math.max(n, min), value[1] ?? max);
        onChange([clamped, value[1]]);
        setLocalMin(String(clamped));
      }
    },
    [min, max, value, onChange]
  );

  const commitMax = useCallback(
    (raw: string) => {
      const n = parseFloat(raw);
      if (raw === '' || isNaN(n)) {
        onChange([value[0], null]);
      } else {
        const clamped = Math.max(Math.min(n, max), value[0] ?? min);
        onChange([value[0], clamped]);
        setLocalMax(String(clamped));
      }
    },
    [min, max, value, onChange]
  );

  const handleReset = () => {
    onChange([null, null]);
    setLocalMin('');
    setLocalMax('');
  };

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-sm font-medium text-gray-900">{label}</span>
          {unit && <span className="text-xs text-gray-400 ml-1">{unit}</span>}
          {description && (
            <p className="text-xs text-gray-400 mt-0.5">{description}</p>
          )}
        </div>
        {isActive && (
          <button
            onClick={handleReset}
            className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {/* Dual slider track */}
      <div className="relative h-5 flex items-center mb-3">
        {/* Track background */}
        <div className="absolute w-full h-1 bg-gray-200 rounded-full" />
        {/* Active track */}
        <div
          className="absolute h-1 bg-blue-500 rounded-full transition-all"
          style={{ left: `${pctMin}%`, width: `${pctMax - pctMin}%` }}
        />
        {/* Min thumb */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={sliderMin}
          onChange={(e) => {
            const n = Number(e.target.value);
            const safe = Math.min(n, sliderMax - step);
            onChange([safe, value[1]]);
            setLocalMin(String(safe));
          }}
          className="absolute w-full h-1 appearance-none bg-transparent cursor-pointer slider-thumb"
          style={{ zIndex: sliderMin > max - (max - min) * 0.1 ? 5 : 3 }}
        />
        {/* Max thumb */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={sliderMax}
          onChange={(e) => {
            const n = Number(e.target.value);
            const safe = Math.max(n, sliderMin + step);
            onChange([value[0], safe]);
            setLocalMax(String(safe));
          }}
          className="absolute w-full h-1 appearance-none bg-transparent cursor-pointer slider-thumb"
          style={{ zIndex: 4 }}
        />
      </div>

      {/* Number inputs */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <input
            type="number"
            placeholder={`Min (${formatValue(min)})`}
            value={localMin}
            onChange={(e) => setLocalMin(e.target.value)}
            onBlur={(e) => commitMin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitMin(localMin)}
            className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder:text-gray-300 transition-all"
          />
        </div>
        <span className="text-gray-300 text-sm">—</span>
        <div className="flex-1">
          <input
            type="number"
            placeholder={`Max (${formatValue(max)})`}
            value={localMax}
            onChange={(e) => setLocalMax(e.target.value)}
            onBlur={(e) => commitMax(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitMax(localMax)}
            className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder:text-gray-300 transition-all"
          />
        </div>
      </div>
    </div>
  );
}
