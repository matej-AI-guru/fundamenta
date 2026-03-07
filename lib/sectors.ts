// Sektorska klasifikacija ZSE dionica (hardkodirano)
export const SECTORS: Record<string, string> = {
  ACI:   'Turizam i usluge',
  ADPL:  'Industrija',
  ADRS:  'Turizam i usluge',
  ADRS2: 'Turizam i usluge',
  ARNT:  'Turizam i usluge',
  ATGR:  'Prehrambena industrija',
  AUHR:  'Maloprodaja',
  CKML:  'Prehrambena industrija',
  CROS:  'Osiguranje',
  CROS2: 'Osiguranje',
  CTKS:  'Industrija',
  DDJH:  'Industrija',
  DLKV:  'Industrija',
  ERNT:  'IT i telekomunikacije',
  GRNL:  'Agroprerada',
  HPB:   'Bankarstvo',
  HT:    'Telekomunikacije',
  IG:    'Građevinarstvo',
  IGH:   'Građevinarstvo',
  IKBA:  'Bankarstvo',
  INA:   'Energetika',
  INGR:  'Građevinarstvo',
  JDGT:  'Prijevoz',
  JDOS:  'Prijevoz',
  JDPL:  'Prijevoz',
  KODT:  'Elektrotehnika',
  KODT2: 'Elektrotehnika',
  KOEI:  'Elektrotehnika',
  KRAS:  'Prehrambena industrija',
  LKPC:  'Infrastruktura',
  LKRI:  'Infrastruktura',
  MDKA:  'Maloprodaja',
  MONP:  'Turizam i usluge',
  PLAG:  'Turizam i usluge',
  PODR:  'Prehrambena industrija',
  RIVP:  'Turizam i usluge',
  SNBA:  'Bankarstvo',
  SPAN:  'IT i telekomunikacije',
  TKPR:  'Maloprodaja',
  TOK:   'Maloprodaja',
  ULPL:  'Prijevoz',
  VLEN:  'Industrija',
  ZABA:  'Bankarstvo',
  ZITO:  'Agroprerada',
};

export function getSector(ticker: string): string {
  return SECTORS[ticker] ?? 'Ostalo';
}

// Vraća tickere iz istog sektora (isključuje danu dionicu), max `limit` rezultata.
// Ako isti sektor nema dovoljno, dopunjuje s ostalim tickerima.
export function getSimilarTickers(ticker: string, allTickers: string[], limit = 5): string[] {
  const sector = SECTORS[ticker];
  const sameSector = allTickers.filter(t => t !== ticker && SECTORS[t] === sector);
  if (sameSector.length >= limit) return sameSector.slice(0, limit);
  // Dopuni s ostatkom ako nema dovoljno u sektoru
  const rest = allTickers.filter(t => t !== ticker && !sameSector.includes(t));
  return [...sameSector, ...rest].slice(0, limit);
}
