// Sektorska klasifikacija ZSE dionica (hardkodirano)
export const SECTORS: Record<string, string> = {
  ACI:   'Turizam i usluge',
  ADPL:  'IT i telekomunikacije',
  ADRS:  'Turizam i usluge',
  ADRS2: 'Turizam i usluge',
  ARNT:  'Turizam i usluge',
  ATGR:  'Maloprodaja',
  AUHR:  'Financije',
  CKML:  'Industrija',
  CROS:  'Osiguranje',
  CROS2: 'Osiguranje',
  CTKS:  'Industrija',
  DDJH:  'Industrija',
  DLKV:  'Industrija',
  ERNT:  'IT i telekomunikacije',
  GRNL:  'Turizam i usluge',
  HPB:   'Bankarstvo',
  HPDG:  'Infrastruktura',
  HT:    'Telekomunikacije',
  IG:    'Industrija',
  IGH:   'Građevinarstvo',
  IKBA:  'Bankarstvo',
  INA:   'Energetika',
  INGR:  'Agroprerada',
  JDGT:  'Turizam i usluge',
  JDOS:  'Prijevoz',
  JDPL:  'Turizam i usluge',
  KODT:  'Elektrotehnika',
  KODT2: 'Elektrotehnika',
  KOEI:  'Elektrotehnika',
  KRAS:  'Prehrambena industrija',
  LKPC:  'Kemija i lijekovi',
  LKRI:  'Kemija i lijekovi',
  MDKA:  'Nekretnine',
  MONP:  'IT i telekomunikacije',
  PLAG:  'Turizam i usluge',
  PODR:  'Prehrambena industrija',
  RIVP:  'Turizam i usluge',
  SNBA:  'Bankarstvo',
  SPAN:  'IT i telekomunikacije',
  TKPR:  'Prehrambena industrija',
  TOK:   'Maloprodaja',
  ULPL:  'Drvna industrija',
  VLEN:  'Energetika',
  ZABA:  'Bankarstvo',
  ZITO:  'Prehrambena industrija',
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
