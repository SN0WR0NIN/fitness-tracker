import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from './prisma';
import type { Prisma } from '@prisma/client';

export const UsernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,29}$/, 'Use 3–30 letters, numbers, dots, underscores or hyphens.');
export const NewPasswordSchema = z.string().min(12, 'Use at least 12 characters.').max(72, 'Use no more than 72 characters.').refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes.');
export const ContactEmailSchema = z.string().trim().toLowerCase().email().max(254).refine((email) => !email.endsWith('.invalid'), 'Enter your real email address.');

// Database-backed attempt budget shared by login and first-login setup.
export async function verifyCredentials(identifier: string, password: string) {
  if (identifier.length > 254 || !password || Buffer.byteLength(password, 'utf8') > 72) return null;
  const login = identifier.trim().toLowerCase();
  const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const matches = await tx.user.findMany({ where: login.includes('@') ? { email: { equals: login, mode: 'insensitive' } } : { username: login }, take: 2 });
    if (matches.length !== 1 || matches[0].password === '!UNCLAIMED') return null;
    const account = matches[0];
    const expiredWindow = !account.loginWindowStartedAt || Date.now() - account.loginWindowStartedAt.getTime() >= 15 * 60 * 1000;
    if (!expiredWindow && account.loginAttempts >= 10) return null;
    await tx.user.update({ where: { id: account.id }, data: { loginAttempts: expiredWindow ? 1 : { increment: 1 }, ...(expiredWindow ? { loginWindowStartedAt: new Date() } : {}) } });
    return account;
  }, { isolationLevel: 'Serializable' });
  if (!user || !await bcrypt.compare(password, user.password)) return null;
  if (user.mustChangePassword && (!user.temporaryPasswordExpiresAt || user.temporaryPasswordExpiresAt.getTime() <= Date.now())) return null;
  return user;
}
