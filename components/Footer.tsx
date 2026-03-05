import Link from 'next/link';

const FOOTER_LINKS = {
  alati: [
    { label: 'Screener dionica', href: '/' },
    { label: 'Usporedi dionice', href: '/?compare=' },
    { label: 'Strategije ulaganja', href: '/#strategije' },
    { label: 'Metodologija', href: '/metodologija' },
  ],
  burze: [
    { label: 'ZSE — Zagreb (HR)', href: '/', active: true },
    { label: 'LJSE — Ljubljana (SI)', comingSoon: true },
    { label: 'SASE — Sarajevo (BA)', comingSoon: true },
    { label: 'BSE — Beograd (RS)', comingSoon: true },
    { label: 'BVB — Bukurešt (RO)', comingSoon: true },
  ],
  tvrtka: [
    { label: 'O nama', href: '/o-nama' },
    { label: 'Kontakt', href: '/kontakt' },
    { label: 'Blog', href: '/blog' },
    { label: 'Pravila privatnosti', href: '/privatnost' },
    { label: 'Uvjeti korištenja', href: '/uvjeti' },
  ],
} as const;

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <polyline points="2,12 5,7 9,9 14,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-lg font-bold text-gray-900">Fundamenta</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-4 max-w-[220px]">
              Fundamentalna analiza dionica za dugoročne investitore u regiji.
            </p>
            {/* Social links — TODO: zamijeniti href-ove pravim linkovima */}
            <div className="flex gap-3">
              <a
                href="#"
                aria-label="LinkedIn"
                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs font-bold hover:bg-gray-200 transition-colors"
              >
                in
              </a>
              <a
                href="#"
                aria-label="X / Twitter"
                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs font-bold hover:bg-gray-200 transition-colors"
              >
                𝕏
              </a>
            </div>
          </div>

          {/* Alati */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Alati</p>
            <ul className="space-y-2.5">
              {FOOTER_LINKS.alati.map(link => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Burze */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Burze</p>
            <ul className="space-y-2.5">
              {FOOTER_LINKS.burze.map(link => (
                <li key={link.label} className="flex items-center gap-2">
                  {'href' in link ? (
                    <Link href={link.href} className="text-sm text-gray-900 font-medium hover:text-blue-600 transition-colors">
                      {link.label}
                    </Link>
                  ) : (
                    <span className="text-sm text-gray-400">{link.label}</span>
                  )}
                  {'comingSoon' in link && (
                    <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full font-medium">
                      uskoro
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Tvrtka */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Tvrtka</p>
            <ul className="space-y-2.5">
              {FOOTER_LINKS.tvrtka.map(link => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            {/* TODO: kontakt info */}
            <div className="mt-6 text-sm text-gray-400 space-y-1">
              {/* <p>Ime Prezime</p> */}
              {/* <p>Zagreb, Hrvatska</p> */}
              {/* <a href="mailto:...">email@example.com</a> */}
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-100 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} Fundamenta. Svi podaci su u edukativne svrhe i ne predstavljaju investicijsku preporuku.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span>Hrvatska</span>
            <span>🇭🇷</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
