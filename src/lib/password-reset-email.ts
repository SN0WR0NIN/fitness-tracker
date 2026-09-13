import { prisma } from '@/lib/prisma';

type ResetEmail = {
  requestId: string;
  recipient: string;
  participantName: string;
  token: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character] ?? character);
}

function resetBaseUrl() {
  const configured = process.env.PASSWORD_RESET_BASE_URL || process.env.NEXTAUTH_URL;
  if (!configured) throw new Error('PASSWORD_RESET_EMAIL_NOT_CONFIGURED');
  const url = new URL(configured);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('PASSWORD_RESET_EMAIL_NOT_CONFIGURED');
  return url;
}

function isDisposableE2eEnvironment() {
  if (process.env.CI !== 'true' || process.env.E2E_TEST_MODE !== '1' || process.env.VERCEL || process.env.VERCEL_ENV) return false;
  try {
    const databaseUrl = new URL(process.env.DATABASE_URL || '');
    const applicationUrl = resetBaseUrl();
    return ['127.0.0.1', 'localhost'].includes(databaseUrl.hostname)
      && databaseUrl.pathname === '/fitness_tracker_e2e'
      && ['127.0.0.1', 'localhost'].includes(applicationUrl.hostname);
  } catch {
    return false;
  }
}

export function buildPasswordResetUrl(token: string) {
  const url = new URL('/auth/reset-password', resetBaseUrl());
  url.searchParams.set('token', token);
  return url.toString();
}

export async function sendPasswordResetEmail(input: ResetEmail) {
  const resetUrl = buildPasswordResetUrl(input.token);

  if (isDisposableE2eEnvironment()) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO app_internal.password_reset_test_delivery(request_id,email,token,reset_url)
       VALUES ($1::uuid,$2,$3,$4)
       ON CONFLICT (request_id) DO UPDATE SET email=excluded.email,token=excluded.token,reset_url=excluded.reset_url,created_at=now()`,
      input.requestId,
      input.recipient,
      input.token,
      resetUrl,
    );
    return `e2e:${input.requestId}`;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PASSWORD_RESET_FROM_EMAIL;
  if (!apiKey || !from) throw new Error('PASSWORD_RESET_EMAIL_NOT_CONFIGURED');

  const safeName = escapeHtml(input.participantName);
  const safeUrl = escapeHtml(resetUrl);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [input.recipient],
      subject: 'Reset your KG Stay Active password',
      text: `Hi ${input.participantName},\n\nUse this secure link to reset your KG Stay Active password:\n${resetUrl}\n\nThis link expires in 60 minutes and can only be used once. If you did not request this, you can ignore this email.\n\nKG Stay Active`,
      html: `<p>Hi ${safeName},</p><p>Use the secure button below to reset your KG Stay Active password.</p><p><a href="${safeUrl}" style="display:inline-block;border-radius:10px;background:#2563eb;color:#ffffff;font-weight:700;padding:12px 18px;text-decoration:none">Reset password</a></p><p>This link expires in 60 minutes and can only be used once.</p><p>If you did not request this, you can ignore this email.</p><p>KG Stay Active</p>`,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) throw new Error('PASSWORD_RESET_EMAIL_FAILED');
  const body = await response.json() as { id?: string };
  if (!body.id) throw new Error('PASSWORD_RESET_EMAIL_FAILED');
  return body.id;
}
