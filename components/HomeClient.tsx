'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import FilterPanel from '@/components/FilterPanel';
import StockTable from '@/components/StockTable';
import StrategyCards from '@/components/StrategyCards';
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
    if (key === 'compare') return; // handled separately by StockTable
    const n = parseFloat(val);
    if (!isNaN(n)) (filters as Record<string, number>)[key] = n;
  });
  return filters;
}

interface Props {
  initialStocks: Stock[];
  initialLastUpdated: string | null;
}

export default function HomeClient({ initialStocks, initialLastUpdated }: Props) {
  const [filters, setFilters] = useState<Partial<FilterValues>>({});
  const [stocks, setStocks] = useState<Stock[]>(initialStocks);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(initialLastUpdated);
  const [copied, setCopied] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [nameSearch, setNameSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // On mount: if URL has filters, apply them; otherwise use server-fetched initialStocks
  useEffect(() => {
    const urlFilters = filtersFromUrl();
    if (Object.keys(urlFilters).length > 0) {
      setFilters(urlFilters);
      fetchStocks(urlFilters);
    }
  }, [fetchStocks]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (filterDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [filterDrawerOpen]);

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

  const activeCount = countActiveFilters(filters);

  // Client-side name/ticker search (applied to already-fetched stocks)
  const visibleStocks = nameSearch.trim()
    ? stocks.filter(s =>
        s.name.toLowerCase().includes(nameSearch.toLowerCase()) ||
        s.ticker.toLowerCase().includes(nameSearch.toLowerCase())
      )
    : stocks;

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      {/* Navbar */}
      <nav className="flex-shrink-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/60">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-12 sm:h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Logo mark */}
            <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <polyline points="2,12 5,7 9,9 14,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">Fundamenta</span>
            <span className="hidden sm:inline text-xs text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">ZSE</span>
          </div>

          <div className="flex items-center gap-1 sm:gap-3">
            {lastUpdated && (
              <span className="hidden md:inline text-xs text-gray-400 mr-1">
                {formatLastUpdated(lastUpdated)}
              </span>
            )}

            {/* Search icon — below lg only */}
            <button
              onClick={() => setSearchOpen(v => !v)}
              className={`lg:hidden flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                searchOpen ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-500'
              }`}
              title="Pretraži dionice"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </button>

            {/* Filter button — below lg only */}
            <button
              onClick={() => setFilterDrawerOpen(true)}
              className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              Filteri
              {activeCount > 0 && (
                <span className="bg-blue-600 text-white text-[10px] font-semibold rounded-full w-4 h-4 flex items-center justify-center">
                  {activeCount}
                </span>
              )}
            </button>

            {/* Share button — desktop */}
            <button
              onClick={handleCopy}
              className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
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

        {/* Search bar — slides down when searchOpen, below lg only */}
        {searchOpen && (
          <div className="lg:hidden px-4 pb-3">
            <input
              type="search"
              value={nameSearch}
              onChange={e => setNameSearch(e.target.value)}
              placeholder="Pretraži po imenu ili tickeru..."
              autoFocus
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50
                         focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>
        )}
      </nav>

      {/* Main — fills remaining viewport height */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="h-full max-w-[1400px] mx-auto w-full px-4 sm:px-6 flex flex-col">
          {/* Hero — desktop only */}
          <div className="hidden lg:flex items-end justify-between py-4 flex-shrink-0">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">
                Screener dionica — Zagrebačka burza
              </h1>
              <p className="text-xs text-gray-500 max-w-xl">
                Jedini napredni fundamentalni screener za ZSE. Filtriraj po P/E, ROCE, EV/EBITDA i još 10+ pokazatelja. Besplatno, bez registracije.
              </p>
            </div>
            <div className="flex items-center gap-6 text-right flex-shrink-0 ml-8">
              <div>
                <p className="text-xl font-bold text-gray-900 tabular-nums">{stocks.length}</p>
                <p className="text-[11px] text-gray-400">dionica</p>
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">12+</p>
                <p className="text-[11px] text-gray-400">pokazatelja</p>
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">ZSE</p>
                <p className="text-[11px] text-gray-400">burza</p>
              </div>
            </div>
          </div>

          {/* Strategy cards */}
          <StrategyCards
            allStocks={initialStocks}
            filters={filters}
            onChange={handleFiltersChange}
          />

          {/* Content row — fills remaining height */}
          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-6 pb-4">
            {/* Filter sidebar — desktop only */}
            <div className="hidden lg:flex w-64 xl:w-80 flex-none overflow-y-auto flex-col">
              <FilterPanel
                filters={filters}
                onChange={handleFiltersChange}
                onReset={handleReset}
                activeCount={activeCount}
              />
            </div>

            {/* Results */}
            <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
              <StockTable stocks={visibleStocks} isLoading={isLoading} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter Drawer (mobile / tablet) ───────────────────────────────── */}
      {/* Backdrop */}
      <div
        className={`lg:hidden fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
          filterDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setFilterDrawerOpen(false)}
      />

      {/* Drawer panel */}
      <div
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl flex flex-col transition-transform duration-300 ease-out ${
          filterDrawerOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: '88vh' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Drawer header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold text-gray-900">Filteri</h2>
            {activeCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                {activeCount} aktivnih
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <button
                onClick={handleReset}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Resetiraj
              </button>
            )}
            <button
              onClick={() => setFilterDrawerOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable filter content */}
        <div className="flex-1 overflow-y-auto">
          <FilterPanel
            filters={filters}
            onChange={handleFiltersChange}
            onReset={handleReset}
            activeCount={activeCount}
            compact
          />
        </div>

        {/* Apply button */}
        <div className="px-4 pt-3 pb-6 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={() => setFilterDrawerOpen(false)}
            className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            Primijeni filtere{stocks.length > 0 ? ` · ${visibleStocks.length} dionica` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
