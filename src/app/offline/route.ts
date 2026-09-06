// A self-contained document is intentional: the offline fallback must not
// hydrate the requested private route or depend on JavaScript/network chunks.
export const dynamic = 'force-static';

export function GET() {
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#07122f"><title>Offline · KG Active</title>
<style>html{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07122f;color:#f1f5f9;font:16px/1.65 system-ui,sans-serif;padding:24px}main{width:100%;max-width:480px;padding:32px;border:1px solid #334155;border-radius:24px;background:#0f172a;text-align:center}h1{font-size:30px;line-height:1.25;margin:18px 0}p{color:#cbd5e1}a{display:inline-block;min-height:48px;padding:12px 24px;margin-top:12px;border-radius:12px;background:#bef264;color:#0f172a;font-weight:800;text-decoration:none}a:focus-visible{outline:3px solid white;outline-offset:5px}.label{font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#bef264}</style>
</head><body><main><div class="label">Kilo Golf Stay Active</div><h1>You're offline</h1><p>Reconnect to load live standings or submit an activity for review.</p><p>Any activity draft already saved on this device stays here. A draft is not a submitted activity, and proof uploads require a connection.</p><a href="/dashboard">Try again</a></main></body></html>`, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
