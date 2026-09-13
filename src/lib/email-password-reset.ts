import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { NewPasswordSchema } from '@/lib/account-credentials';

const RESET_TTL_SECONDS = 60 * 60;

type ResetPayload = {
  uid: string;
  sv: number;
  exp: number;
  nonce: string;
};

function signingSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('PASSWORD_RESET_NOT_CONFIGURED');
  return secret;
}

function encodePayload(payload: ResetPayload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function sign(value: string) {
  return createHmac('sha256', signingSecret()).update(value).digest('base64url');
}

function createResetToken(userId: string, sessionVersion: number) {
  const body = encodePayload({
    uid: userId,
    sv: sessionVersion,
    exp: Math.floor(Date.now() / 1000) + RESET_TTL_SECONDS,
    nonce: randomBytes(16).toString('base64url'),
  });
  return `${body}.${sign(body)}`;
}

function verifyResetToken(token: string): ResetPayload {
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra) throw new Error('INVALID_RESET_TOKEN');

  const expected = sign(body);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new Error('INVALID_RESET_TOKEN');
  }

  let payload: ResetPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ResetPayload;
  } catch {
    throw new Error('INVALID_RESET_TOKEN');
  }

  if (!payload.uid || !Number.isInteger(payload.sv) || !Number.isInteger(payload.exp)) {
    throw new Error('INVALID_RESET_TOKEN');
  }
  if (payload.exp <= Math.floor(Date.now() / 1000)) throw new Error('INVALID_RESET_TOKEN');
  return payload;
}

function normalizeOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return url.origin;
  } catch {
    const fallback = process.env.NEXTAUTH_URL;
    if (!fallback) throw new Error('PASSWORD_RESET_NOT_CONFIGURED');
    return new URL(fallback).origin;
  }
}

async function sendResetEmail(email: string, name: string, resetUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('PASSWORD_RESET_EMAIL_NOT_CONFIGURED');

  const from = process.env.PASSWORD_RESET_FROM_EMAIL || 'KG Stay Active <onboarding@resend.dev>';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Reset your KG Stay Active password',
      text: `Hi ${name},\n\nWe received a request to reset your KG Stay Active password. Use this secure link within 1 hour:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email. Your password will not change.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111827"><h2>Reset your KG Stay Active password</h2><p>Hi ${escapeHtml(name)},</p><p>We received a request to reset your KG Stay Active password.</p><p><a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Reset password</a></p><p style="color:#6b7280;font-size:14px">This secure link expires in 1 hour. If you did not request this, you can ignore this email and your password will remain unchanged.</p></div>`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('Password reset email failed', response.status, detail.slice(0, 300));
    throw new Error('PASSWORD_RESET_EMAIL_FAILED');
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function requestEmailPasswordReset(identifier: string, origin: string) {
  const login = identifier.trim().toLowerCase().slice(0, 254);
  if (!login) return;

  const user = await prisma.user.findFirst({
    where: {
      role: 'MEMBER',
      password: { not: '!UNCLAIMED' },
      ...(login.includes('@')
        ? { email: { equals: login, mode: 'insensitive' } }
        : { username: login }),
    },
    select: { id: true, name: true, email: true, sessionVersion: true },
  });
  if (!user) return;

  const token = createResetToken(user.id, user.sessionVersion);
  const resetUrl = `${normalizeOrigin(origin)}/auth/reset-password?token=${encodeURIComponent(token)}`;
  await sendResetEmail(user.email, user.name, resetUrl);
}

export async function completeEmailPasswordReset(token: string, newPassword: string) {
  const parsedNewPassword = NewPasswordSchema.parse(newPassword);
  const payload = verifyResetToken(token);

  const user = await prisma.user.findUnique({
    where: { id: payload.uid },
    select: { id: true, password: true, sessionVersion: true, role: true },
  });
  if (!user || user.role !== 'MEMBER' || user.sessionVersion !== payload.sv) {
    throw new Error('INVALID_RESET_TOKEN');
  }
  if (await bcrypt.compare(parsedNewPassword, user.password)) throw new Error('PASSWORD_REUSE');

  const passwordHash = await bcrypt.hash(parsedNewPassword, 12);
  const changed = await prisma.user.updateMany({
    where: { id: user.id, sessionVersion: payload.sv },
    data: {
      password: passwordHash,
      mustChangePassword: false,
      temporaryPasswordExpiresAt: null,
      sessionVersion: { increment: 1 },
      loginAttempts: 0,
      loginWindowStartedAt: null,
    },
  });
  if (!changed.count) throw new Error('INVALID_RESET_TOKEN');
}
