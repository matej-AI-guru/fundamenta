import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/alerts — subscribe email to daily alert with current filters
export async function POST(req: NextRequest) {
  let body: { email?: string; filters?: object };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { email, filters = {} } = body;

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Neispravan email' }, { status: 400 });
  }

  // Upsert: if email exists → update filters and reactivate; else insert
  const { error } = await supabaseAdmin
    .from('email_alerts')
    .upsert(
      { email: email.toLowerCase().trim(), filters, active: true },
      { onConflict: 'email' }
    );

  if (error) {
    console.error('Alert upsert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
