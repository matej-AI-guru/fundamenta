import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase';
import type { FilterValues, EmailAlert, Stock } from '@/lib/supabase';

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = req.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) return true;
  const manual = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret');
  return manual === cronSecret;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyRange(
  q: any,
  col: string,
  min: number | null | undefined,
  max: number | null | undefined
) {
  if (min !== null && min !== undefined) q = q.gte(col, min);
  if (max !== null && max !== undefined) q = q.lte(col, max);
  return q;
}

async function fetchMatchingStocks(filters: Partial<FilterValues>): Promise<Stock[]> {
  let query = supabaseAdmin.from('stocks').select('*').order('ticker', { ascending: true });

  query = applyRange(query, 'pe_ratio',          filters.pe_min,            filters.pe_max);
  query = applyRange(query, 'market_cap',         filters.market_cap_min,    filters.market_cap_max);
  query = applyRange(query, 'net_margin',         filters.net_margin_min,    filters.net_margin_max);
  query = applyRange(query, 'pb_ratio',           filters.pb_min,            filters.pb_max);
  query = applyRange(query, 'revenue_ttm',        filters.revenue_min,       filters.revenue_max);
  query = applyRange(query, 'net_profit_ttm',     filters.net_profit_min,    filters.net_profit_max);
  query = applyRange(query, 'ps_ratio',           filters.ps_min,            filters.ps_max);
  query = applyRange(query, 'pcf_ratio',          filters.pcf_min,           filters.pcf_max);
  query = applyRange(query, 'pfcf_ratio',         filters.pfcf_min,          filters.pfcf_max);
  query = applyRange(query, 'eps_ttm',            filters.eps_min,           filters.eps_max);
  query = applyRange(query, 'roe',                filters.roe_min,           filters.roe_max);
  query = applyRange(query, 'earnings_yield',     filters.earnings_yield_min, filters.earnings_yield_max);
  query = applyRange(query, 'ev_ebitda',          filters.ev_ebitda_min,     filters.ev_ebitda_max);

  const { data } = await query;
  return data ?? [];
}

function fmt(v: number | null): string {
  if (v === null || v === undefined) return '—';
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(2);
}
const fmtPct = (v: number | null) => (v !== null ? `${v.toFixed(2)}%` : '—');
const fmtX   = (v: number | null) => (v !== null ? `${v.toFixed(2)}x` : '—');

function buildFilterUrl(filters: Partial<FilterValues>): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fundamenta.vercel.app';
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== null && v !== undefined) params.set(k, String(v));
  });
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function filterSummary(filters: Partial<FilterValues>): string {
  const labels: Record<string, string> = {
    pe_min: 'P/E min', pe_max: 'P/E max',
    market_cap_min: 'Tržišna kap. min', market_cap_max: 'Tržišna kap. max',
    net_margin_min: 'Neto marža min', net_margin_max: 'Neto marža max',
    pb_min: 'P/B min', pb_max: 'P/B max',
    ev_ebitda_min: 'EV/EBITDA min', ev_ebitda_max: 'EV/EBITDA max',
    roe_min: 'ROE min', roe_max: 'ROE max',
    eps_min: 'EPS min', eps_max: 'EPS max',
  };
  return Object.entries(filters)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${labels[k] ?? k}: ${v}`)
    .join(', ') || 'Svi tickeri (bez filtera)';
}

function buildEmailHtml(stocks: Stock[], filters: Partial<FilterValues>, unsubscribeUrl: string): string {
  const appUrl = buildFilterUrl(filters);
  const date = new Date().toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const rows = stocks.map((s) => `
    <tr style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:10px 14px;font-weight:600;color:#1d1d1f;white-space:nowrap;">${s.ticker}</td>
      <td style="padding:10px 14px;color:#333;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.name}</td>
      <td style="padding:10px 14px;text-align:right;color:#333;white-space:nowrap;">${s.price ? `${s.price.toFixed(2)} ${s.currency}` : '—'}</td>
      <td style="padding:10px 14px;text-align:right;color:#333;">${fmtX(s.pe_ratio)}</td>
      <td style="padding:10px 14px;text-align:right;color:#333;">${fmtX(s.pb_ratio)}</td>
      <td style="padding:10px 14px;text-align:right;color:${s.net_margin !== null && s.net_margin > 0 ? '#059669' : s.net_margin !== null ? '#dc2626' : '#333'};">${fmtPct(s.net_margin)}</td>
      <td style="padding:10px 14px;text-align:right;color:${s.roe !== null && s.roe > 0 ? '#059669' : s.roe !== null ? '#dc2626' : '#333'};">${fmtPct(s.roe)}</td>
      <td style="padding:10px 14px;text-align:right;color:#333;">${fmtX(s.ev_ebitda)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="hr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:700px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="padding:24px 32px;border-bottom:1px solid #f0f0f0;">
      <span style="font-size:20px;font-weight:700;color:#1d1d1f;">Fundamenta</span>
      <span style="font-size:12px;color:#6e6e73;margin-left:10px;">ZSE</span>
      <p style="margin:8px 0 0;font-size:13px;color:#6e6e73;">${date}</p>
    </div>

    <!-- Summary -->
    <div style="padding:20px 32px;background:#f9f9fb;border-bottom:1px solid #f0f0f0;">
      <p style="margin:0;font-size:15px;color:#1d1d1f;">
        Pronađeno <strong>${stocks.length}</strong> ${stocks.length === 1 ? 'dionica' : stocks.length < 5 ? 'dionice' : 'dionica'} prema vašem filteru.
      </p>
      <p style="margin:6px 0 0;font-size:12px;color:#6e6e73;">${filterSummary(filters)}</p>
    </div>

    <!-- Table -->
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f9f9fb;border-bottom:2px solid #e5e5ea;">
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#6e6e73;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;">Ticker</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#6e6e73;text-transform:uppercase;letter-spacing:0.05em;">Tvrtka</th>
            <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:600;color:#6e6e73;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;">Cijena</th>
            <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:600;color:#6e6e73;text-transform:uppercase;letter-spacing:0.05em;">P/E</th>
            <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:600;color:#6e6e73;text-transform:uppercase;letter-spacing:0.05em;">P/B</th>
            <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:600;color:#6e6e73;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;">Neto marža</th>
            <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:600;color:#6e6e73;text-transform:uppercase;letter-spacing:0.05em;">ROE</th>
            <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:600;color:#6e6e73;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;">EV/EBITDA</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <!-- CTA -->
    <div style="padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0;">
      <a href="${appUrl}" style="display:inline-block;padding:12px 28px;background:#0071e3;color:#fff;border-radius:980px;font-size:14px;font-weight:600;text-decoration:none;">
        Otvori u Fundamenta
      </a>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;border-top:1px solid #f0f0f0;text-align:center;">
      <p style="margin:0;font-size:12px;color:#6e6e73;">
        Podaci s investiramo.com &nbsp;·&nbsp; Ovo nije financijski savjet.
        <br>
        <a href="${unsubscribeUrl}" style="color:#0071e3;text-decoration:none;">Odjavi se od obavijesti</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

// GET /api/alerts/send — Vercel cron at 0 7 * * *
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.ALERT_FROM_EMAIL ?? 'Fundamenta <alerts@fundamenta.hr>';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fundamenta.vercel.app';

  // Fetch all active alerts
  const { data: alerts, error: alertsError } = await supabaseAdmin
    .from('email_alerts')
    .select('*')
    .eq('active', true);

  if (alertsError) {
    return NextResponse.json({ error: alertsError.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;

  for (const alert of (alerts as EmailAlert[]) ?? []) {
    const stocks = await fetchMatchingStocks(alert.filters);

    if (stocks.length === 0) {
      skipped++;
      continue;
    }

    const unsubscribeUrl = `${appUrl}/api/alerts/unsubscribe?token=${alert.token}`;
    const html = buildEmailHtml(stocks, alert.filters, unsubscribeUrl);

    const { error: sendError } = await resend.emails.send({
      from: fromEmail,
      to: alert.email,
      subject: `Fundamenta: ${stocks.length} ${stocks.length === 1 ? 'dionica odgovara' : stocks.length < 5 ? 'dionice odgovaraju' : 'dionica odgovara'} vašem filteru`,
      html,
    });

    if (sendError) {
      console.error(`Failed to send to ${alert.email}:`, sendError);
      skipped++;
    } else {
      sent++;
    }
  }

  console.log(`Alerts: ${sent} sent, ${skipped} skipped (no results or send error), ${alerts?.length ?? 0} total active`);
  return NextResponse.json({ total: alerts?.length ?? 0, sent, skipped });
}
