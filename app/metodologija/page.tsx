import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Metodologija pokazatelja — Fundamenta',
  description:
    'Detaljan opis svih financijskih pokazatelja na Fundamenta platformi: P/E omjer, ROCE, EV/EBITDA, Buffett metrika, ROE, slobodni novčani tok i još 10+. Formule, interpretacija i ograničenja.',
  alternates: { canonical: '/metodologija' },
  openGraph: {
    title: 'Metodologija pokazatelja — Fundamenta',
    description:
      'Kako se računaju P/E, ROCE, EV/EBITDA, Buffett metrika i svi ostali pokazatelji na Fundamenta platformi.',
    url: 'https://fundamenta-analiza.vercel.app/metodologija',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Formula({ children }: { children: string }) {
  return (
    <div className="my-4 rounded-xl bg-slate-50 border border-slate-200 px-5 py-3.5 font-mono text-sm text-slate-800 leading-relaxed">
      {children}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-xl bg-amber-50 border border-amber-200 px-5 py-4 text-sm text-amber-800 leading-relaxed">
      {children}
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-xl bg-blue-50 border border-blue-200 px-5 py-4 text-sm text-blue-800 leading-relaxed">
      {children}
    </div>
  );
}

function SectionAnchor({ id }: { id: string }) {
  return <span id={id} className="-mt-20 pt-20 block" />;
}

function MetricCard({
  id,
  title,
  subtitle,
  formula,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  formula: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-12">
      <SectionAnchor id={id} />
      <h3 className="text-xl font-bold text-gray-900 mb-0.5">{title}</h3>
      {subtitle && <p className="text-sm text-gray-400 mb-3">{subtitle}</p>}
      <Formula>{formula}</Formula>
      <div className="text-gray-700 leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MetodologijaPage() {
  return (
    <>
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-200/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-12 sm:h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <polyline points="2,12 5,7 9,9 14,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">Fundamenta</span>
            <span className="hidden sm:inline text-xs text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">ZSE</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Natrag na screener
          </Link>
        </div>
      </nav>

      {/* ── Content ── */}
      <div className="bg-white">
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

          {/* Hero */}
          <div className="mb-12 pb-10 border-b border-gray-100">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-3">Dokumentacija</p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
              Metodologija pokazatelja
            </h1>
            <p className="text-lg text-gray-500 leading-relaxed max-w-2xl">
              Ovaj dokument objašnjava kako se računaju svi financijski pokazatelji prikazani na Fundamenta platformi —
              formule, interpretacija i ograničenja za svakog od njih.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              {[
                ['#valuacija', 'Valuacija'],
                ['#profitabilnost', 'Profitabilnost'],
                ['#buffett', 'Buffett metrika'],
                ['#novcani-tok', 'Novčani tok'],
                ['#bilanca', 'Bilanca'],
                ['#ogranicenja', 'Ograničenja'],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors font-medium"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

          {/* Izvor podataka */}
          <section className="mb-12">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Izvor podataka</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Svi financijski podaci prikupljaju se automatski s platforme{' '}
              <span className="font-medium text-gray-900">mojedionice.com</span> koja agregira podatke iz službenih
              financijskih izvještaja (GFI) objavljenih pri FINA-i. Podaci obuhvaćaju zadnji dostupni{' '}
              <span className="font-medium">godišnji izvještaj</span> — bilance stanja, račun dobiti i gubitka te
              izvještaj o novčanim tokovima.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Tržišni podaci (cijena, tržišna kapitalizacija, dividenda) preuzimaju se sa Sažetak stranice dionice
              i odražavaju zadnju dostupnu cijenu. Scraping se pokreće automatski jednom dnevno u 06:00h.
            </p>
          </section>

          {/* ═══ Valuacija ═══ */}
          <section className="mb-4">
            <SectionAnchor id="valuacija" />
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Valuacijski pokazatelji</h2>
            <p className="text-gray-500 text-sm mb-8">
              Valuacijski pokazatelji uspoređuju tržišnu cijenu dionice s temeljnim financijskim veličinama tvrtke.
              Odgovaraju na pitanje: <em>koliko plaćam za ono što dobivam?</em>
            </p>

            <MetricCard
              id="pe"
              title="P/E omjer"
              subtitle="Price-to-Earnings Ratio · Omjer cijene i zarade"
              formula="P/E = Tržišna kapitalizacija ÷ Neto dobit
       ili: P/E = Cijena dionice ÷ EPS"
            >
              <p>
                P/E omjer govori koliko puta investitor plaća godišnju zaradu tvrtke. P/E od 15× znači da investitor
                plaća 15 EUR za svaki EUR godišnje neto dobiti — ili da bi pri nepromijenjenim uvjetima trebalo 15 godina
                da tvrtka „vrati" tržišnu cijenu kroz zaradu.
              </p>
              <p>
                <strong>Niži P/E</strong> načelno sugerira povoljniju valuaciju — ali isključivo uz pozitivnu dobit.
                Dionice s negativnom dobiti nemaju smisleni P/E pa Fundamenta takve slučajeve ne prikazuje niti ih
                uključuje u filtre za P/E.
              </p>
              <Tip>
                <strong>Interpretacija:</strong> Za ZSE tržište, P/E ispod 10× smatra se dubokom vrijednošću, 10–20× razumnim, a iznad 25× skupom valuacijom — no ovo varira po industrijama. Ciklične tvrtke (gradnja, brodogradnja) imaju prirodno nestabilne P/E omjere.
              </Tip>
              <Note>
                <strong>Upozorenje:</strong> P/E mjeri zaradu iz prošlosti. Tvrtka s jednokratnom dobiti ili jednokratnim gubitkom može imati izrazito iskrivljen P/E. Uvijek provjeri jesu li rezultati repetitivni.
              </Note>
            </MetricCard>

            <MetricCard
              id="pb"
              title="P/B omjer"
              subtitle="Price-to-Book Ratio · Omjer cijene i knjige"
              formula="P/B = Tržišna kapitalizacija ÷ Kapital dioničara (vlastiti kapital)"
            >
              <p>
                P/B omjer uspoređuje tržišnu vrijednost tvrtke s njenom knjižnom vrijednošću — ukupnom imovinom
                umanjenom za sve obveze. Knjižna vrijednost predstavlja ono što bi dioničari dobili da se tvrtka
                odmah likvidira po bilančnim vrijednostima.
              </p>
              <p>
                <strong>P/B ispod 1×</strong> sugerira da tržište vrednuje tvrtku ispod njene knjižne vrijednosti — klasičan
                signal za Grahamove value investitore. Može ukazivati na potcijenjenost, ali i na strukturalne probleme u
                poslovanju ili zastarjelu imovinu.
              </p>
              <Tip>
                <strong>Osobito koristan za:</strong> banke, osiguravatelje i holding-tvrtke čija vrijednost leži pretežno u financijskoj imovini. Za tehnološke ili uslužne tvrtke s malo fizičke imovine, P/B je manje relevantan.
              </Tip>
            </MetricCard>

            <MetricCard
              id="ev-ebitda"
              title="EV/EBITDA"
              subtitle="Enterprise Value to EBITDA"
              formula="EV = Tržišna kap. + Dugoročne obveze − Novac i novčani ekvivalenti
EV/EBITDA = EV ÷ EBITDA"
            >
              <p>
                EV/EBITDA mjeri vrijednost cijelog poduzeća (uključujući dug, ne samo dioničare) u odnosu na
                operativnu profitabilnost prije kamata, poreza i amortizacije. Popularniji je od P/E jer eliminira
                razlike u zaduženosti i poreznom opterećenju između tvrtki.
              </p>
              <p>
                <strong>Enterprise Value (EV)</strong> je „puna cijena preuzimanja" — koliko bi stajalo kupiti cijelu tvrtku:
                tržišna kapitalizacija plus preuzimanje duga, minus gotovina koja ostaje u tvrtki.
              </p>
              <p>
                EV/EBITDA ispod 8× često se smatra konzervativnom valuacijom, no referentne vrijednosti variraju
                po sektoru. Warren Buffett i Charlie Munger koristili su EV/EBITDA kao primarnu metriku pri razmatranju
                akvizicija.
              </p>
              <Note>
                <strong>Ograničenje:</strong> EV/EBITDA nije prikazan za banke, osiguravatelje i financijske institucije. Kod banaka, novac u bilanci su zapravo depoziti klijenata (obveze), pa bi EV bio negativan — što je besmisleno. Fundamenta automatski isključuje EV/EBITDA za financijske tvrtke.
              </Note>
            </MetricCard>

            <MetricCard
              id="ps"
              title="P/S omjer"
              subtitle="Price-to-Sales Ratio · Omjer cijene i prihoda"
              formula="P/S = Tržišna kapitalizacija ÷ Ukupni prihodi"
            >
              <p>
                P/S omjer stavlja tržišnu vrijednost tvrtke u omjer s njenim godišnjim prihodom od prodaje.
                Koristan je za tvrtke koje još nisu profitabilne — za razliku od P/E, uvijek se može izračunati
                dok tvrtka ima prihode.
              </p>
              <p>
                P/S ispod 1× znači da tržišna kapitalizacija nije veća od godišnjeg prihoda — relativno povoljno.
                No sam prihod ne govori ništa o profitabilnosti: tvrtka može imati visok prihod uz niske marže.
                Uvijek kombinirati s neto maržom.
              </p>
            </MetricCard>

            <MetricCard
              id="pcf"
              title="P/CF omjer"
              subtitle="Price-to-Cash Flow"
              formula="P/CF = Tržišna kapitalizacija ÷ Operativni novčani tok"
            >
              <p>
                P/CF je slično P/E, ali umjesto računovodstvene dobiti koristi operativni novčani tok — koji je
                teže „ukrasiti" jednokratnim stavkama. Tvrtka može iskazivati dobit dok joj novac zapravo odlijeva;
                P/CF to razotkriva.
              </p>
            </MetricCard>

            <MetricCard
              id="prinos-zaradu"
              title="Prinos na zaradu"
              subtitle="Earnings Yield"
              formula="Prinos na zaradu = (1 ÷ P/E) × 100
             ili: EPS ÷ Cijena dionice × 100"
            >
              <p>
                Inverzna vrijednost P/E omjera, izražena u postocima. Direktno usporedivo s prinosom obveznice
                ili kamatom na štednju: prinos na zaradu od 8% znači da tvrtka za svaku EUR uloženu u dionicu
                generira 0,08 EUR godišnje zarade.
              </p>
              <Tip>
                <strong>Zašto koristiti?</strong> Warren Buffett svaki potencijalni ulog uspoređuje s prinosom 30-godišnje američke obveznice. Ako prinos na zaradu dionice nije konzistentno iznad nerizičnih instrumenata, dionica je preskupa — bez obzira na priču o rastu.
              </Tip>
            </MetricCard>
          </section>

          {/* ═══ Profitabilnost ═══ */}
          <section className="mb-4 pt-4 border-t border-gray-100">
            <SectionAnchor id="profitabilnost" />
            <h2 className="text-2xl font-bold text-gray-900 mb-1 mt-8">Profitabilnost</h2>
            <p className="text-gray-500 text-sm mb-8">
              Pokazatelji profitabilnosti mjere koliko efikasno tvrtka pretvara prihode i kapital u dobit.
            </p>

            <MetricCard
              id="neto-marza"
              title="Neto marža"
              subtitle="Net Profit Margin"
              formula="Neto marža = (Neto dobit ÷ Ukupni prihodi) × 100"
            >
              <p>
                Neto marža pokazuje koliki postotak prihoda ostaje kao dobit nakon svih troškova, kamata i poreza.
                Marža od 10% znači da od svakih 100 EUR prihoda tvrtka zadržava 10 EUR čiste dobiti.
              </p>
              <p>
                Usporediva unutar iste industrije, ali ne između sektora. Supermarketi s prometom od milijardi
                EUR tipično imaju maržu od 1–3%, dok softverske tvrtke mogu imati 30%+. Na ZSE tržištu marže
                iznad 15% smatraju se iznimno dobrima.
              </p>
            </MetricCard>

            <MetricCard
              id="roe"
              title="ROE — Povrat na kapital"
              subtitle="Return on Equity"
              formula="ROE = (Neto dobit ÷ Kapital dioničara) × 100"
            >
              <p>
                ROE mjeri koliko efikasno menadžment koristi kapital koji su mu povjerili dioničari za generiranje
                dobiti. ROE od 20% znači da tvrtka za svakih 100 EUR vlastitog kapitala stvara 20 EUR dobiti godišnje.
              </p>
              <p>
                Warren Buffett navodi ROE konzistentno iznad 15% kao jedan od primarnih kriterija za prepoznavanje
                tvrtki s trajnom konkurentskom prednošću (engl. <em>economic moat</em>).
              </p>
              <Note>
                <strong>Zamka visokog ROE:</strong> Iznimno visok ROE (40%+) može nastati i zbog visokog zaduženosti — financijska poluga povećava ROE, ali i rizik. Uvijek provjeri zajedno s tekućom likvidnošću i razinom duga.
              </Note>
            </MetricCard>

            <MetricCard
              id="roce"
              title="ROCE — Povrat na angažirani kapital"
              subtitle="Return on Capital Employed"
              formula="ROCE = (EBIT ÷ (Ukupna aktiva − Kratkoročne obveze)) × 100

Kapital u upotrebi = Ukupna aktiva − Kratkoročne obveze"
            >
              <p>
                ROCE je sveobuhvatniji od ROE jer u nazivnik uključuje cjelokupni dugoročni kapital koji tvrtka
                koristi — i vlastiti i posudeni. Kratkoročne obveze se oduzimaju jer su to operativni dugovi
                (dobavljači, plaće) koji se stalno recikliraju, a ne dugoročni kapital.
              </p>
              <p>
                ROCE iznad 15% konzistentno kroz više godina pouzdan je signal izvrsnog menadžmenta i snažne
                tržišne pozicije. Buffett eksplicitno navodi ROCE (ili ekvivalentnu metriku povrata na kapital)
                kao ključan kriterij pri odabiru tvrtki za dugoročno ulaganje.
              </p>
              <Tip>
                <strong>Zašto je ROCE bolji od ROE?</strong> ROE može biti visok zbog zaduživanja (poluge), dok ROCE to korigira. Tvrtka s ROCE od 20% i niskim dugom bolji je posao od tvrtke s ROE od 25% i visokim dugom.
              </Tip>
            </MetricCard>

            <MetricCard
              id="ebit"
              title="EBIT"
              subtitle="Earnings Before Interest and Taxes · Operativna dobit"
              formula="EBIT = Poslovni prihodi − Poslovni rashodi
     (bez kamata i bez poreza na dobit)"
            >
              <p>
                EBIT (operativna dobit) pokazuje profitabilnost temeljnog poslovanja tvrtke — bez utjecaja njene
                financijske strukture (koliko duguje i po kojoj kamati) i bez poreznog opterećenja koje varira
                po jurisdikcijama.
              </p>
              <p>
                Na Fundamenta platformi, EBIT se čita direktno iz Računa dobiti i gubitka s mojedionice.com —
                iz retka koji sadrži operativnu dobit ili EBIT u GFI izvještaju.
              </p>
            </MetricCard>

            <MetricCard
              id="ebitda"
              title="EBITDA"
              subtitle="Earnings Before Interest, Taxes, Depreciation and Amortization"
              formula="EBITDA = EBIT + Amortizacija"
            >
              <p>
                EBITDA dodaje amortizaciju natrag na EBIT, eliminirajući i utjecaj računovodstvenih procjena
                vijek trajanja imovine. Koristio se popularno kao aproksimacija operativnog novčanog toka,
                premda je slobodni novčani tok (FCF) preciznija mjera.
              </p>
              <p>
                Na Fundamenta platformi, amortizacija se čita iz RDG-a (AOP 17). Za tvrtke gdje amortizacija
                nije dostupna u izvještaju, EBITDA se izjednačava s EBIT-om (amortizacija = 0).
              </p>
              <Note>
                <strong>„EBITDA nije novac"</strong> — Charlie Munger poznato komentira da Berkshire Hathaway nikad ne koristi EBITDA jer ne uzima u obzir kapitalnu intenzivnost. Tvrtka koja troši 500M EUR godišnje na opremu ne može ignorirati amortizaciju. EBITDA je koristan za usporedbu, ali FCF za donošenje odluka.
              </Note>
            </MetricCard>

            <MetricCard
              id="eps"
              title="EPS — Zarada po dionici"
              subtitle="Earnings Per Share"
              formula="EPS = Neto dobit ÷ Broj dionica u opticaju"
            >
              <p>
                EPS normalizira ukupnu zaradu tvrtke na razinu jedne dionice, omogućujući direktnu usporedbu
                s cijenom dionice. Osnova je za izračun P/E omjera.
              </p>
              <p>
                Rast EPS-a kroz više godina — bez razvodnjivanja broja dionica — jasan je signal da tvrtka
                stvara vrijednost za dioničare.
              </p>
            </MetricCard>
          </section>

          {/* ═══ Buffett metrika ═══ */}
          <section className="mb-4 pt-4 border-t border-gray-100">
            <SectionAnchor id="buffett" />
            <h2 className="text-2xl font-bold text-gray-900 mb-1 mt-8">Buffett metrika</h2>
            <p className="text-gray-500 text-sm mb-8">
              Pojednostavljena aproksimacija intrinzične vrijednosti tvrtke, inspirirana Buffettovim pristupom value investiranja.
            </p>

            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Intrinzična vrijednost (Buffett metrika)</h3>
              <Formula>{`Buffett metrika = Novac + Kratkotrajna fin. imovina + (EBIT × 10)

Gdje:
  Novac                  = novac i novčani ekvivalenti (bilanca)
  Kratkotrajna fin. imov. = kratkotrajna financijska imovina (bilanca)
  EBIT × 10              = konzervativni P/E od 10× primijenjen na operativnu dobit`}</Formula>
              <div className="text-gray-700 leading-relaxed space-y-3">
                <p>
                  Formula procjenjuje koliko bi bila vrijedna tvrtka za <em>strateškog kupca</em>: likvidna imovina
                  koja je odmah dostupna, plus operativna sposobnost zarade vrednovana konzervativnim multiplikatorom
                  od 10×. Množitelj 10 odgovara prinosu na zaradu od 10% — što je Buffettova minimalna granica
                  prihvatljivog prinosa na uloženi kapital.
                </p>
                <p>
                  Ovo je <strong>namjerno konzervativna</strong> procjena: ne uzima u obzir rast, nematerijalna
                  dobra, tržišnu poziciju niti buduće novčane tokove. Tvrtke koje prođu ovaj filter moraju imati
                  snažnu trenutnu poziciju — rast je tada bonus.
                </p>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Buffett podcijenjenost</h3>
              <Formula>{`Buffett podcijenjenost = (Buffett metrika ÷ Tržišna kapitalizacija) − 1

Primjer: metrika = 1.200 M EUR, tržišna kap. = 900 M EUR
  → podcijenjenost = (1.200 / 900) - 1 = +33,3%  (potencijalno podcijenjena za 33%)`}</Formula>
              <div className="text-gray-700 leading-relaxed space-y-3">
                <p>
                  Buffett podcijenjenost izražava u postocima koliko je procijenjena intrinzična vrijednost veća
                  ili manja od tržišne kapitalizacije.
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  <li><strong>Pozitivna vrijednost:</strong> intrinzična vrijednost premašuje tržišnu cijenu — potencijalno potcijenjena dionica</li>
                  <li><strong>Negativna vrijednost:</strong> tržišna cijena premašuje procjenu — nema margine sigurnosti</li>
                  <li><strong>Filtar &gt;20%:</strong> u Buffett strategiji na Fundamenta screener tražimo dionice s podcijenjenošću od najmanje 20%</li>
                </ul>
              </div>
              <Note>
                <strong>Ovo nije Buffettova službena metoda.</strong> Warren Buffett koristi diskontiranje budućih novčanih tokova (DCF) uz subjektivnu procjenu konkurentske prednosti — što nije lako automatizirati za 45 dionica. Ova formula je pojednostavljena aproksimacija koja hvata isti princip: platiti manje od konzervativne procjene stvarne vrijednosti. Koristite je kao polazišnu točku, ne kao konačnu odluku.
              </Note>
            </div>
          </section>

          {/* ═══ Novčani tok ═══ */}
          <section className="mb-4 pt-4 border-t border-gray-100">
            <SectionAnchor id="novcani-tok" />
            <h2 className="text-2xl font-bold text-gray-900 mb-1 mt-8">Novčani tok</h2>
            <p className="text-gray-500 text-sm mb-8">
              Novčani tok otkriva koliko stvarnog novca tvrtka generira — za razliku od računovodstvene dobiti,
              teže ga je manipulirati.
            </p>

            <MetricCard
              id="fcf"
              title="Slobodni novčani tok (FCF)"
              subtitle="Free Cash Flow"
              formula="FCF = Operativni novčani tok − Kapitalni izdaci (CapEx)

Operativni novčani tok: iz Izvještaja o novčanim tokovima (AOP 20)
CapEx: kapitalni izdaci za nabavu dugotrajne imovine (AOP 28, apsolutna vrijednost)"
            >
              <p>
                Slobodni novčani tok je novac koji tvrtka <em>zapravo generira</em> nakon što podmiri sve
                operativne troškove i uloži u održavanje i razvoj imovine (CapEx). To je novac koji može biti
                isplaćen dioničarima kao dividenda, korišten za otkup dionica, otplatu duga ili rast kroz akvizicije.
              </p>
              <p>
                <strong>FCF &gt; 0</strong> je primarni uvjet za ulaganje prema FCF strategiji na Fundamenta platformi.
                Tvrtka s negativnim FCF konstantno troši više nego što zarađuje — što je održivo samo uz vanjsko
                financiranje ili dobre investicijske prilike.
              </p>
              <Tip>
                <strong>Zašto je FCF važniji od dobiti?</strong> Dobit se može povećati računovodstvenim procjenama (npr. promjenom metode amortizacije). Novčani tok je teže lažirati — novac ili jest ili nije na računu.
              </Tip>
            </MetricCard>

            <MetricCard
              id="pfcf"
              title="P/FCF omjer"
              subtitle="Price-to-Free-Cash-Flow"
              formula="P/FCF = Tržišna kapitalizacija ÷ Slobodni novčani tok

Prikazuje se samo za dionice s FCF > 0"
            >
              <p>
                P/FCF je analogon P/E-u, ali umjesto računovodstvene dobiti koristi slobodni novčani tok.
                P/FCF ispod 15× tipično se smatra atraktivnim — znači da investitor plaća manje od 15 EUR
                za svaki EUR slobodnog novčanog toka.
              </p>
            </MetricCard>

            <MetricCard
              id="pcf-metrika"
              title="P/CF omjer"
              subtitle="Price-to-Cash Flow (operativni)"
              formula="P/CF = Tržišna kapitalizacija ÷ Operativni novčani tok"
            >
              <p>
                P/CF je nešto konzervativniji od P/FCF jer ne oduzima CapEx — korisno za usporedbu tvrtki
                različite kapitalne intenzivnosti unutar iste industrije.
              </p>
            </MetricCard>
          </section>

          {/* ═══ Bilanca ═══ */}
          <section className="mb-4 pt-4 border-t border-gray-100">
            <SectionAnchor id="bilanca" />
            <h2 className="text-2xl font-bold text-gray-900 mb-1 mt-8">Bilanca i tržišni podaci</h2>
            <p className="text-gray-500 text-sm mb-8">
              Pokazatelji temeljeni na bilanci stanja i tržišnim podacima dionice.
            </p>

            <MetricCard
              id="current-ratio"
              title="Tekuća likvidnost"
              subtitle="Current Ratio"
              formula="Tekuća likvidnost = Kratkotrajna imovina ÷ Kratkoročne obveze"
            >
              <p>
                Mjeri sposobnost tvrtke da podmiri kratkoročne obveze (koje dospijevaju unutar godinu dana)
                kratkotrajnom imovinom (gotovinom, potraživanjima, zalihama).
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li><strong>&gt; 2,0:</strong> odlična likvidnost — tvrtka dvostruko pokriva kratkoročne obveze</li>
                <li><strong>1,5–2,0:</strong> dobra likvidnost</li>
                <li><strong>1,0–1,5:</strong> prihvatljivo, nema rezerve za neočekivane troškove</li>
                <li><strong>&lt; 1,0:</strong> upozorenje — kratkoročne obveze veće od kratkotrajna imovine</li>
              </ul>
              <Note>
                Supermarketi i maloprodajne tvrtke tipično imaju nižu tekuću likvidnost jer operiraju s negativnim radnim kapitalom — kupci plaćaju odmah, dobavljači daju rok. Tekuća likvidnost se treba interpretirati u kontekstu industrije.
              </Note>
            </MetricCard>

            <MetricCard
              id="dividend-yield"
              title="Dividendni prinos"
              subtitle="Dividend Yield"
              formula="Dividendni prinos = (Dividenda po dionici ÷ Cijena dionice) × 100"
            >
              <p>
                Dividendni prinos pokazuje godišnji prihod od dividende kao postotak trenutne cijene dionice.
                Podaci se preuzimaju iz zadnjeg dostupnog podatka o isplaćenoj dividendi s mojedionice.com.
              </p>
              <p>
                Za ZSE tržište, dividendni prinos iznad 3% smatra se solidnim. Mnoge tvrtke na ZSE (banke,
                holding-tvrtke) isplaćuju konzistentne dividende. Uvijek provjeriti je li dividenda pokrivena
                FCF-om — visok prinos uz negativan FCF nije održiv.
              </p>
            </MetricCard>

            <MetricCard
              id="market-cap"
              title="Tržišna kapitalizacija"
              subtitle="Market Cap"
              formula="Tržišna kap. = Cijena dionice × Broj dionica u opticaju"
            >
              <p>
                Ukupna tržišna vrijednost svih izdanih dionica tvrtke. Osnova za kategorije: mikro kap. (&lt;30M EUR),
                mala kap. (&lt;300M EUR), srednja kap. (&lt;2B EUR), velika kap. (&gt;2B EUR).
              </p>
              <p>
                Na ZSE-u, većina dionica spada u kategoriju malih i mikro kompanija — što donosi potencijal
                za veće prinose, ali i manju likvidnost i veće informacijske rizike.
              </p>
            </MetricCard>

            <MetricCard
              id="book-value"
              title="Knjigovodstvena vrijednost po dionici"
              subtitle="Book Value Per Share"
              formula="BV/dionici = Kapital dioničara ÷ Broj dionica u opticaju"
            >
              <p>
                Teorijska vrijednost jedne dionice temeljena na bilanci — što bi dioničar dobio po dionici
                pri likvidaciji po bilančnim vrijednostima. Osnova za izračun P/B omjera.
              </p>
            </MetricCard>

            <MetricCard
              id="total-assets"
              title="Ukupna aktiva i kapital"
              subtitle="Total Assets · Equity"
              formula="Ukupna aktiva = Dugotrajna imovina + Kratkotrajna imovina
Kapital = Ukupna aktiva − Ukupne obveze"
            >
              <p>
                Ukupna aktiva daje uvid u veličinu tvrtke mjerenu imovinom. Kapital dioničara (vlastiti kapital)
                je ostatak koji pripada vlasnicima nakon podmirenja svih obveza — temelj za ROE i P/B izračune.
              </p>
            </MetricCard>
          </section>

          {/* ═══ Ograničenja ═══ */}
          <section className="mb-4 pt-4 border-t border-gray-100">
            <SectionAnchor id="ogranicenja" />
            <h2 className="text-2xl font-bold text-gray-900 mb-1 mt-8">Ograničenja i napomene</h2>
            <p className="text-gray-500 text-sm mb-8">
              Transparentnost je temelj povjerenja — ovdje jasno navodimo što podaci ne mogu reći.
            </p>

            <div className="space-y-6 text-gray-700 leading-relaxed">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">1. Financijske institucije</h3>
                <p>
                  Banke, osiguravatelji i ostale financijske tvrtke (ZABA, HPB, SNBA, ATGR, ADRS, ADRS2...)
                  imaju specifičnu strukturu bilance gdje mnogi standardni pokazatelji nisu usporedivi s
                  nefinancijskim tvrtkama. EV/EBITDA se automatski isključuje za ove tvrtke. ROCE i ROE
                  treba interpretirati uz poseban oprez jer kapital kod banaka uključuje regulatorski kapital.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-1">2. Godišnji podaci</h3>
                <p>
                  Svi financijski podaci temeljeni su na zadnjem dostupnom godišnjem izvještaju. Tvrtke koje
                  su u međuvremenu objavile kvartalne ili polugodišnje rezultate mogu imati materijalno
                  drugačiju trenutnu situaciju. Datum zadnjeg ažuriranja vidljiv je u zaglavlju screener-a.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-1">3. Jednokratne stavke</h3>
                <p>
                  Jednokratni prihodi ili rashodi (prodaja imovine, sudski sporovi, restrukturiranja) mogu
                  privremeno izobličiti EBIT, neto dobit i sve derivirane metrike. Uvijek pregledajte
                  originalni izvještaj za kontekst — Fundamenta prikazuje normalizirane godišnje podatke,
                  ali ne razlikuje jednokratne od repetitivnih stavki.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-1">4. Nelikvidnost ZSE tržišta</h3>
                <p>
                  Zagrebačka burza je relativno nelikvidno tržište. Mnoge dionice imaju mali free-float i
                  malen dnevni promet, što znači da tržišna cijena ne mora uvijek odražavati fer vrijednost.
                  Informacijska asimetrija je veća nego na razvijenim tržištima — što stvara i prilike i rizike.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-1">5. Holding-tvrtke</h3>
                <p>
                  Holding-tvrtke (INA, IG, IGH, INGR...) prikazuju konsolidirane podatke koji uključuju
                  poslovanje čitavih grupacija. Financijski pokazatelji na razini holdinga mogu biti
                  teški za usporedbu s operativnim tvrtkama.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-1">6. Edukativna svrha</h3>
                <p>
                  Svi podaci i alati na Fundamenta platformi su <strong>isključivo u edukativne svrhe</strong>{' '}
                  i ne predstavljaju investicijsku preporuku, savjet ili poziv na ulaganje. Ulaganje na
                  financijskim tržištima nosi rizik gubitka uloženog kapitala. Uvijek konzultirajte
                  licenciranog financijskog savjetnika i provedite vlastitu dubinsku analizu.
                </p>
              </div>
            </div>
          </section>

          {/* ═══ Pregled formula ═══ */}
          <section className="mt-12 pt-8 border-t border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Brzi pregled svih formula</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 pr-4 font-semibold text-gray-700">Pokazatelj</th>
                    <th className="text-left py-3 font-semibold text-gray-700">Formula</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    ['P/E', 'Tržišna kap. ÷ Neto dobit'],
                    ['P/B', 'Tržišna kap. ÷ Kapital'],
                    ['EV/EBITDA', '(Tržišna kap. + Dugor. obveze − Novac) ÷ EBITDA'],
                    ['P/S', 'Tržišna kap. ÷ Prihodi'],
                    ['P/CF', 'Tržišna kap. ÷ Operativni novčani tok'],
                    ['P/FCF', 'Tržišna kap. ÷ Slobodni novčani tok'],
                    ['Prinos na zaradu', '(1 ÷ P/E) × 100'],
                    ['Neto marža', '(Neto dobit ÷ Prihodi) × 100'],
                    ['ROE', '(Neto dobit ÷ Kapital) × 100'],
                    ['ROCE', '(EBIT ÷ (Aktiva − Kratk. obveze)) × 100'],
                    ['EBITDA', 'EBIT + Amortizacija'],
                    ['EPS', 'Neto dobit ÷ Broj dionica'],
                    ['FCF', 'Operativni novčani tok − CapEx'],
                    ['Tekuća likvidnost', 'Kratkotrajna imovina ÷ Kratkoročne obveze'],
                    ['Dividendni prinos', '(Dividenda ÷ Cijena) × 100'],
                    ['Tržišna kap.', 'Cijena × Broj dionica'],
                    ['BV/dionici', 'Kapital ÷ Broj dionica'],
                    ['Buffett metrika', 'Novac + Kratk. fin. imov. + (EBIT × 10)'],
                    ['Buffett podcijenjenost', '(Buffett metrika ÷ Tržišna kap.) − 1'],
                  ].map(([name, formula]) => (
                    <tr key={name} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 pr-4 font-medium text-gray-900 whitespace-nowrap">{name}</td>
                      <td className="py-2.5 font-mono text-xs text-gray-600">{formula}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* CTA */}
          <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div>
              <p className="text-gray-900 font-semibold mb-1">Spreman za ulaganje?</p>
              <p className="text-sm text-gray-500">Primijeni filtere i pronađi dionice koje odgovaraju tvojoj strategiji.</p>
            </div>
            <Link
              href="/"
              className="flex-shrink-0 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Otvori screener →
            </Link>
          </div>

        </main>
      </div>

      <Footer />
    </>
  );
}
