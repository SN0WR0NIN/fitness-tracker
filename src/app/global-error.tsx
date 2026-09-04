'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body><main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#07122f', color: 'white', padding: 24, fontFamily: 'sans-serif' }}><section style={{ maxWidth: 520, textAlign: 'center' }}><h1>KG Active needs a refresh</h1><p style={{ color: '#94a3b8', lineHeight: 1.6 }}>The app could not finish loading. Your stored data has not been changed.</p><button type="button" onClick={reset} style={{ marginTop: 16, border: 0, borderRadius: 12, padding: '12px 20px', background: '#f97316', color: 'white', fontWeight: 800 }}>Reload app</button></section></main></body></html>;
}
