'use client';

import { useState } from 'react';
import type { FilterValues } from '@/lib/supabase';

interface AlertSubscribeProps {
  filters: Partial<FilterValues>;
}

type State = 'idle' | 'loading' | 'success' | 'error';

export default function AlertSubscribe({ filters }: AlertSubscribeProps) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmedEmail, setConfirmedEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), filters }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Greška pri postavljanju alarma.');
        setState('error');
      } else {
        setConfirmedEmail(email.trim());
        setState('success');
      }
    } catch {
      setErrorMsg('Mrežna greška. Pokušajte ponovo.');
      setState('error');
    }
  };

  return (
    <div className="mx-4 mb-4 rounded-xl bg-blue-50 border border-blue-100 overflow-hidden">
      {/* Card header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-2.5">
        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold text-blue-900">Dnevna obavijest</p>
          <p className="text-[11px] text-blue-600 leading-tight">Svaki dan u 9:00</p>
        </div>
      </div>

      {/* Card body */}
      <div className="px-4 pb-4">
        {state === 'success' ? (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-white border border-blue-100">
            <svg className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-xs font-medium text-gray-800">Alarm postavljen</p>
              <p className="text-xs text-gray-500 mt-0.5 break-all">{confirmedEmail}</p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-blue-700 mb-3 leading-relaxed">
              Primaj dionice koje zadovoljavaju trenutne filtere svaki dan u 9:00.
            </p>

            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@primjer.com"
                required
                disabled={state === 'loading'}
                className="flex-1 min-w-0 px-3 py-2 text-xs border border-blue-200 rounded-lg bg-white
                           focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent
                           disabled:opacity-50 placeholder-blue-300 text-gray-700"
              />
              <button
                type="submit"
                disabled={state === 'loading' || !email}
                className="flex-shrink-0 px-3 py-2 bg-blue-600 text-white text-xs font-medium
                           rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors"
              >
                {state === 'loading' ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                )}
              </button>
            </form>

            {state === 'error' && (
              <p className="mt-2 text-xs text-red-500">{errorMsg}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
