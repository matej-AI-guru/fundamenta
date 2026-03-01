import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/alerts/unsubscribe?token=xxx
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return new NextResponse(errorHtml('Neispravan link za odjavu.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const { error } = await supabaseAdmin
    .from('email_alerts')
    .update({ active: false })
    .eq('token', token);

  if (error) {
    return new NextResponse(errorHtml('Došlo je do greške. Pokušajte ponovo.'), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return new NextResponse(successHtml(), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function successHtml() {
  return page(
    'Odjava uspješna',
    '#059669',
    'Uspješno ste se odjavili.',
    'Više nećete primati dnevne obavijesti od Fundamenta.'
  );
}

function errorHtml(msg: string) {
  return page('Greška', '#dc2626', 'Odjava nije uspjela.', msg);
}

function page(title: string, color: string, heading: string, body: string) {
  return `<!DOCTYPE html>
<html lang="hr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Fundamenta — ${title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="background:#fff;border-radius:16px;padding:40px 48px;text-align:center;max-width:400px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <p style="font-size:20px;font-weight:700;color:#1d1d1f;margin:0 0 4px;">Fundamenta</p>
    <p style="font-size:13px;color:#6e6e73;margin:0 0 24px;">ZSE</p>
    <p style="font-size:17px;font-weight:600;color:${color};margin:0 0 8px;">${heading}</p>
    <p style="font-size:14px;color:#6e6e73;margin:0 0 24px;">${body}</p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? '/'}" style="display:inline-block;padding:10px 24px;background:#0071e3;color:#fff;border-radius:980px;font-size:14px;font-weight:600;text-decoration:none;">
      Natrag na Fundamenta
    </a>
  </div>
</body>
</html>`;
}
