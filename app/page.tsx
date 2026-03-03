import { supabase } from '@/lib/supabase';
import HomeClient from '@/components/HomeClient';

// Always fetch fresh data — don't cache
export const dynamic = 'force-dynamic';

export default async function Home() {
  const { data: stocks } = await supabase
    .from('stocks')
    .select('*')
    .order('market_cap', { ascending: false });

  const initialStocks = stocks ?? [];
  const initialLastUpdated = initialStocks.length > 0 ? initialStocks[0].last_updated : null;

  return (
    <HomeClient
      initialStocks={initialStocks}
      initialLastUpdated={initialLastUpdated}
    />
  );
}
