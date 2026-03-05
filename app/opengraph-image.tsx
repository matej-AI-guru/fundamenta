import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Fundamenta — Screener dionica Zagrebačke burze';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0f172a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '40px',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              background: '#1d4ed8',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="28" height="22" viewBox="0 0 28 22" fill="none">
              <polyline
                points="2,18 8,10 15,13 26,2"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span style={{ fontSize: '36px', fontWeight: 700, color: 'white' }}>Fundamenta</span>
          <span
            style={{
              fontSize: '16px',
              fontWeight: 500,
              color: '#64748b',
              background: '#1e293b',
              padding: '4px 12px',
              borderRadius: '20px',
            }}
          >
            ZSE
          </span>
        </div>

        {/* Heading — two separate divs instead of <br /> */}
        <div style={{ fontSize: '56px', fontWeight: 800, color: 'white', lineHeight: 1.1 }}>
          Screener dionica
        </div>
        <div style={{ fontSize: '56px', fontWeight: 800, color: 'white', lineHeight: 1.1, marginBottom: '24px' }}>
          Zagrebačke burze
        </div>

        {/* Subtitle — single text node, no wrapping */}
        <div style={{ fontSize: '22px', color: '#94a3b8', maxWidth: '680px', lineHeight: 1.4, marginBottom: '48px' }}>
          Filtriraj po P/E, ROCE, EV/EBITDA i 10+ fundamentalnih pokazatelja. Besplatno, bez registracije.
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {['P/E omjer', 'ROCE', 'EV/EBITDA', 'Buffett metrika', 'FCF', 'Dividende'].map((label) => (
            <div
              key={label}
              style={{
                background: '#1e293b',
                color: '#93c5fd',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '18px',
                fontWeight: 500,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
