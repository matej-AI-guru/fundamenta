'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import FilterPanel from '@/components/FilterPanel';
import StockTable from '@/components/StockTable';
import type { Stock, FilterValues } from '@/lib/supabase';

const DEBOUNCE_MS = 600;

function countActiveFilters(filters: Partial<FilterValues>): number {
  return Object.values(filters).filter((v) => v !== null && v !== undefined).length;
}

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = sessionStorage.getItem('fundamenta_session');
  if (!id) {
    id = Math.random().toString(36).slice(2);
    sessionStorage.setItem('fundamenta_session', id);
  }
  return id;
}

function filtersToUrl(filters: Partial<FilterValues>): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== null && v !== undefined) params.set(k, String(v));
  });
  return params.toString();
}

function filtersFromUrl(): Partial<FilterValues> {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const filters: Partial<FilterValues> = {};
  params.forEach((val, key) => {
    (filters as Record<string, number>)[key] = parseFloat(val);
  });
  return filters;
}

export default function Home() {
  const [filters, setFilters] = useState<Partial<FilterValues>>({});
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mobileTab, setMobileTab] = useState<'filters' | 'stocks'>('stocks');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const urlFilters = filtersFromUrl();
    if (Object.keys(urlFilters).length > 0) setFilters(urlFilters);
  }, []);

  const fetchStocks = useCallback(async (f: Partial<FilterValues>) => {
    setIsLoading(true);
    try {
      const qs = Object.keys(f).length > 0 ? `?filters=${encodeURIComponent(JSON.stringify(f))}` : '';
      const res = await fetch(`/api/stocks${qs}`, {
        headers: { 'x-session-id': getSessionId() },
      });
      const data = await res.json();
      setStocks(data.stocks ?? []);
      if (data.stocks?.length > 0) setLastUpdated(data.stocks[0].last_updated);
    } catch {
      setStocks([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleFiltersChange = (newFilters: Partial<FilterValues>) => {
    setFilters(newFilters);
    const qs = filtersToUrl(newFilters);
    window.history.replaceState({}, '', qs ? `?${qs}` : window.location.pathname);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchStocks(newFilters), DEBOUNCE_MS);
  };

  const handleReset = () => {
    setFilters({});
    window.history.replaceState({}, '', window.location.pathname);
    fetchStocks({});
  };

  useEffect(() => {
    fetchStocks(filtersFromUrl());
  }, [fetchStocks]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatLastUpdated = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    const date = d.toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = d.toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' });
    return `Ažurirano ${date} ${time}`;
  };

  return (
    <div className="h-screen flex flex-col bg-[#F5F5F7] overflow-hidden">
      {/* Navbar */}
      <nav className="flex-shrink-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/60">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight text-gray-900">Fundamenta</span>
            <span className="hidden sm:inline text-xs text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
              ZSE
            </span>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdated && (
              <span className="hidden md:inline text-xs text-gray-400">
                {formatLastUpdated(lastUpdated)}
              </span>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
              title="Kopiraj link s filterima"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
              {copied ? 'Kopirano!' : 'Dijeli'}
            </button>
          </div>
        </div>
      </nav>

      {/* Main — fills remaining viewport height */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="h-full max-w-[1400px] mx-auto w-full px-4 sm:px-6 flex flex-col">
          {/* Heading — desktop only */}
          <div className="hidden lg:block py-5 flex-shrink-0">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-1">
              Filtriranje dionica
            </h1>
            <p className="text-sm text-gray-500">
              Pronađi dionice na ZSE prema financijskim pokazateljima. Podaci s investiramo.com, ažuriraju se jednom dnevno.
            </p>
          </div>

          {/* Mobile tab switcher */}
          <div className="lg:hidden flex-shrink-0 pt-3 pb-3">
            <div className="flex rounded-xl bg-gray-100 p-1">
              <button
                onClick={() => setMobileTab('filters')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  mobileTab === 'filters' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                Filteri{countActiveFilters(filters) > 0 ? ` (${countActiveFilters(filters)})` : ''}
              </button>
              <button
                onClick={() => setMobileTab('stocks')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  mobileTab === 'stocks' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                Dionice ({stocks.length})
              </button>
            </div>
          </div>

          {/* Content row — fills remaining height */}
          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-6 pb-4">
            {/* Filter sidebar — scrolls independently */}
            <div className={`w-full lg:w-80 xl:w-96 flex-1 min-h-0 lg:flex-none overflow-y-auto ${mobileTab === 'filters' ? 'flex flex-col' : 'hidden'} lg:flex lg:flex-col`}>
              <FilterPanel
                filters={filters}
                onChange={handleFiltersChange}
                onReset={handleReset}
                activeCount={countActiveFilters(filters)}
              />
            </div>

            {/* Results — fills remaining width and height */}
            <div className={`flex-1 min-w-0 overflow-hidden ${mobileTab === 'stocks' ? 'flex flex-col' : 'hidden'} lg:flex lg:flex-col`}>
              <StockTable stocks={stocks} isLoading={isLoading} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
