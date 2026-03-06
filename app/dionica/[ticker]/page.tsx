import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ZSE_TICKERS, sifSimFromTicker } from '@/lib/scraper';
import { getSector, getSimilarTickers } from '@/lib/sectors';
import { getDescription } from '@/lib/descriptions';
import { computeDetailedScore } from '@/lib/score';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { Stock, StockFinancials, PriceHistory } from '@/lib/supabase';
import StockPageClient from './StockPageClient';

export const revalidate = 3600; // ISR — rebuild every hour

export async function generateStaticParams() {
  return ZSE_TICKERS.map((ticker) => ({ ticker }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}): Promise<Metadata> {
  const { ticker } = await params;
  const supabase = getSupabaseAdmin();
  const { data: stock } = await supabase
    .from('stocks')
    .select('name,pe_ratio,roce,ev_ebitda')
    .eq('ticker', ticker)
    .single();

  if (!stock) return { title: `${ticker} | Fundamenta` };

  const pe  = stock.pe_ratio  ? `P/E ${stock.pe_ratio.toFixed(1)}x` : null;
  const roce = stock.roce ? `ROCE ${stock.roce.toFixed(1)}%` : null;
  const ev  = stock.ev_ebitda ? `EV/EBITDA ${stock.ev_ebitda.toFixed(1)}x` : null;
  const metrics = [pe, roce, ev].filter(Boolean).join(', ');

  return {
    title: `${stock.name} (${ticker}) — Fundamentalna analiza | Fundamenta`,
    description: `${stock.name}${metrics ? ` · ${metrics}` : ''}. Kompletna fundamentalna analiza s povijesnim podacima. ZSE.`,
    alternates: {
      canonical: `https://fundamenta-analiza.vercel.app/dionica/${ticker}`,
    },
    openGraph: {
      title: `${ticker}: ${stock.name} | Fundamenta`,
      description: `Fundamentalna analiza ${stock.name} na Zagrebačkoj burzi (ZSE)`,
    },
  };
}

function computeMedians(stocks: Stock[]): Record<string, number | null> {
  const keys: (keyof Stock)[] = [
    'pe_ratio', 'pb_ratio', 'ev_ebitda', 'ps_ratio', 'pfcf_ratio', 'earnings_yield',
    'net_margin', 'roe', 'roce',
  ];
  const result: Record<string, number | null> = {};
  for (const key of keys) {
    const vals = stocks
      .map(s => s[key] as number | null)
      .filter((v): v is number => v !== null && isFinite(v));
    if (vals.length === 0) { result[key as string] = null; continue; }
    const sorted = [...vals].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    result[key as string] = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
  return result;
}

export default async function StockPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;

  if (!ZSE_TICKERS.includes(ticker)) notFound();

  const supabase = getSupabaseAdmin();

  const [{ data: stock }, { data: allStocks }, { data: financials }, { data: priceHistoryRaw }] = await Promise.all([
    supabase.from('stocks').select('*').eq('ticker', ticker).single(),
    supabase.from('stocks').select('*').order('market_cap', { ascending: false }),
    supabase
      .from('stock_financials')
      .select('*')
      .eq('ticker', ticker)
      .order('year', { ascending: true }),
    supabase
      .from('price_history')
      .select('id,ticker,date,price,created_at')
      .eq('ticker', ticker)
      .order('date', { ascending: true }),
  ]);

  if (!stock || !allStocks) notFound();

  const scores = computeDetailedScore(ticker, allStocks);
  const sector = getSector(ticker);
  const similarTickers = getSimilarTickers(ticker, allStocks.map((s) => s.ticker));
  const similarStocks = allStocks.filter((s) => similarTickers.includes(s.ticker));
  const zseMedians = computeMedians(allStocks);
  const sifSim = sifSimFromTicker(ticker);
  const description = getDescription(ticker);

  // Sektorski medijani (min 4 dionice da bi bilo smisleno)
  const sectorStocks = allStocks.filter((s) => getSector(s.ticker) === sector);
  const sectorMedians = sectorStocks.length >= 4 ? computeMedians(sectorStocks) : null;

  // JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FinancialProduct',
    name: `${stock.name} (${ticker})`,
    description: `Dionica ${stock.name} na Zagrebačkoj burzi (ZSE)`,
    url: `https://fundamenta-analiza.vercel.app/dionica/${ticker}`,
    provider: {
      '@type': 'Organization',
      name: stock.name,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <StockPageClient
        stock={stock}
        financials={(financials ?? []) as StockFinancials[]}
        scores={scores}
        sector={sector}
        similarStocks={similarStocks}
        zseMedians={zseMedians}
        sectorMedians={sectorMedians}
        description={description}
        sifSim={sifSim}
        priceHistory={(priceHistoryRaw ?? []) as PriceHistory[]}
      />
    </>
  );
}
