import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { NewPasswordSchema, verifyCredentials } from '@/lib/account-credentials';

export type PasswordResetStatus = 'OPEN' | 'ISSUED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

export type PasswordResetRequest = {
  id: string;
  userId: string;
  status: PasswordResetStatus;
  requestCount: number;
  requestedAt: Date;
  lastRequestedAt: Date;
  issuedAt: Date | null;
  expiresAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  issuedById: string | null;
  issuedByName: string | null;
  user: {
    id: string;
    name: string;
    username: string | null;
    email: string;
    columnName: string | null;
  };
};

const RESET_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase().slice(0, 254);
}

async function expireStalePasswordResets() {
  await prisma.$executeRawUnsafe(`
    UPDATE app_internal.password_reset_request
    SET status='EXPIRED', updated_at=now()
    WHERE status='ISSUED' AND expires_at IS NOT NULL AND expires_at <= now()
  `);
}

export async function requestPasswordReset(identifier: string) {
  const login = normalizeIdentifier(identifier);
  if (!login) return;

  const user = await prisma.user.findFirst({
    where: {
      role: 'MEMBER',
      password: { not: '!UNCLAIMED' },
      ...(login.includes('@')
        ? { email: { equals: login, mode: 'insensitive' } }
        : { username: login }),
    },
    select: { id: true, name: true },
  });
  if (!user) return;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const rows = await tx.$queryRawUnsafe<Array<{ id: string; status: PasswordResetStatus; expiresAt: Date | null }>>(
      `SELECT id, status, expires_at AS "expiresAt"
       FROM app_internal.password_reset_request
       WHERE user_id=$1 AND status IN ('OPEN','ISSUED')
       ORDER BY created_at DESC
       FOR UPDATE`,
      user.id,
    );

    let active = rows[0] ?? null;
    if (active?.status === 'ISSUED' && active.expiresAt && active.expiresAt.getTime() <= Date.now()) {
      await tx.$executeRawUnsafe(
        `UPDATE app_internal.password_reset_request
         SET status='EXPIRED', updated_at=now()
         WHERE id=$1`,
        active.id,
      );
      active = null;
    }

    let requestId: string;
    if (active) {
      requestId = active.id;
      await tx.$executeRawUnsafe(
        `UPDATE app_internal.password_reset_request
         SET request_count=request_count+1, last_requested_at=now(), updated_at=now()
         WHERE id=$1`,
        active.id,
      );
    } else {
      const inserted = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `INSERT INTO app_internal.password_reset_request(user_id)
         VALUES ($1)
         RETURNING id`,
        user.id,
      );
      requestId = inserted[0].id;
    }

    await tx.$executeRawUnsafe(
      `INSERT INTO app_internal.notification(user_id, kind, level, title, message, href, metadata, dedupe_key)
       SELECT u.id, 'ACCOUNT_RESET_REQUEST', 'info', 'Password reset requested', $1, '/admin/password-resets',
         jsonb_build_object('requestId',$2,'participantId',$3),
         'password-reset-request:' || $2 || ':' || u.id
       FROM public."User" u
       WHERE u.role='ADMIN'
       ON CONFLICT (dedupe_key) DO UPDATE SET
         title=excluded.title, message=excluded.message, href=excluded.href, metadata=excluded.metadata, created_at=now()`,
      `${user.name} requested help resetting their password.`,
      requestId,
      user.id,
    );
  }, { isolationLevel: 'Serializable' });
}

export async function hasIssuedPasswordReset(userId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM app_internal.password_reset_request
     WHERE user_id=$1 AND status='ISSUED' AND expires_at > now()
     ORDER BY issued_at DESC LIMIT 1`,
    userId,
  );
  return rows.length > 0;
}

export async function getPasswordResetRequests(): Promise<PasswordResetRequest[]> {
  await expireStalePasswordResets();
  return prisma.$queryRawUnsafe<PasswordResetRequest[]>(`
    SELECT
      r.id,
      r.user_id AS "userId",
      r.status,
      r.request_count AS "requestCount",
      r.requested_at AS "requestedAt",
      r.last_requested_at AS "lastRequestedAt",
      r.issued_at AS "issuedAt",
      r.expires_at AS "expiresAt",
      r.completed_at AS "completedAt",
      r.cancelled_at AS "cancelledAt",
      r.issued_by_id AS "issuedById",
      r.issued_by_name AS "issuedByName",
      jsonb_build_object(
        'id',u.id,
        'name',u.name,
        'username',u.username,
        'email',u.email,
        'columnName',c.name
      ) AS user
    FROM app_internal.password_reset_request r
    JOIN public."User" u ON u.id=r.user_id
    LEFT JOIN public."Column" c ON c.id=u."columnId"
    ORDER BY
      CASE r.status WHEN 'OPEN' THEN 0 WHEN 'ISSUED' THEN 1 ELSE 2 END,
      r.last_requested_at DESC
    LIMIT 150
  `);
}

export async function getActivePasswordResetCount() {
  await expireStalePasswordResets();
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT count(*)::bigint AS count
     FROM app_internal.password_reset_request
     WHERE status IN ('OPEN','ISSUED')`,
  );
  return Number(rows[0]?.count ?? 0);
}

export async function issuePasswordReset(requestId: string, adminId: string) {
  const temporaryPassword = randomBytes(18).toString('base64url');
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const rows = await tx.$queryRawUnsafe<Array<{
      id: string;
      status: PasswordResetStatus;
      userId: string;
      name: string;
      username: string | null;
      email: string;
      role: string;
    }>>(
      `SELECT r.id, r.status, u.id AS "userId", u.name, u.username, u.email, u.role
       FROM app_internal.password_reset_request r
       JOIN public."User" u ON u.id=r.user_id
       WHERE r.id=$1
       FOR UPDATE OF r, u`,
      requestId,
    );
    const request = rows[0];
    if (!request || !['OPEN','ISSUED'].includes(request.status)) throw new Error('RESET_REQUEST_CHANGED');
    if (request.role !== 'MEMBER') throw new Error('RESET_MEMBER_ONLY');

    const admin = await tx.user.findUnique({ where: { id: adminId }, select: { name: true } });
    if (!admin) throw new Error('ADMIN_NOT_FOUND');

    await tx.user.update({
      where: { id: request.userId },
      data: {
        password: passwordHash,
        mustChangePassword: true,
        temporaryPasswordExpiresAt: expiresAt,
        sessionVersion: { increment: 1 },
        loginAttempts: 0,
        loginWindowStartedAt: null,
      },
    });

    await tx.$executeRawUnsafe(
      `UPDATE app_internal.password_reset_request
       SET status='ISSUED', issued_at=now(), expires_at=$2, issued_by_id=$3, issued_by_name=$4, updated_at=now()
       WHERE id=$1`,
      requestId,
      expiresAt,
      adminId,
      admin.name,
    );

    await tx.$executeRawUnsafe(
      `INSERT INTO public."AdminAudit"("id","actorId","actorName","action","target","details")
       VALUES ($1,$2,$3,'PASSWORD_RESET_ISSUED',$4,$5::jsonb)`,
      randomUUID(),
      adminId,
      admin.name,
      request.userId,
      JSON.stringify({ requestId, expiresAt: expiresAt.toISOString() }),
    );

    return {
      requestId,
      participantName: request.name,
      login: request.username || request.email,
      temporaryPassword,
      expiresAt,
    };
  }, { isolationLevel: 'Serializable' });
}

export async function cancelPasswordReset(requestId: string, adminId: string) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const rows = await tx.$queryRawUnsafe<Array<{ userId: string; status: PasswordResetStatus }>>(
      `SELECT user_id AS "userId", status
       FROM app_internal.password_reset_request
       WHERE id=$1
       FOR UPDATE`,
      requestId,
    );
    const request = rows[0];
    if (!request || request.status !== 'OPEN') throw new Error('RESET_REQUEST_CHANGED');
    const admin = await tx.user.findUnique({ where: { id: adminId }, select: { name: true } });
    if (!admin) throw new Error('ADMIN_NOT_FOUND');

    await tx.$executeRawUnsafe(
      `UPDATE app_internal.password_reset_request
       SET status='CANCELLED', cancelled_at=now(), updated_at=now()
       WHERE id=$1`,
      requestId,
    );

    await tx.$executeRawUnsafe(
      `INSERT INTO public."AdminAudit"("id","actorId","actorName","action","target","details")
       VALUES ($1,$2,$3,'PASSWORD_RESET_CANCELLED',$4,$5::jsonb)`,
      randomUUID(),
      adminId,
      admin.name,
      request.userId,
      JSON.stringify({ requestId }),
    );
  }, { isolationLevel: 'Serializable' });
}

export async function completePasswordReset(identifier: string, temporaryPassword: string, newPassword: string) {
  const parsedNewPassword = NewPasswordSchema.parse(newPassword);
  const user = await verifyCredentials(identifier, temporaryPassword);
  if (!user?.mustChangePassword) throw new Error('INVALID_RESET_CREDENTIALS');
  if (await bcrypt.compare(parsedNewPassword, user.password)) throw new Error('PASSWORD_REUSE');

  const resetRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM app_internal.password_reset_request
     WHERE user_id=$1 AND status='ISSUED' AND expires_at > now()
     ORDER BY issued_at DESC LIMIT 1`,
    user.id,
  );
  const reset = resetRows[0];
  if (!reset) throw new Error('INVALID_RESET_CREDENTIALS');

  const passwordHash = await bcrypt.hash(parsedNewPassword, 12);
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const locked = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM app_internal.password_reset_request
       WHERE id=$1 AND user_id=$2 AND status='ISSUED' AND expires_at > now()
       FOR UPDATE`,
      reset.id,
      user.id,
    );
    if (!locked.length) throw new Error('INVALID_RESET_CREDENTIALS');

    const changed = await tx.user.updateMany({
      where: {
        id: user.id,
        password: user.password,
        mustChangePassword: true,
        temporaryPasswordExpiresAt: { gt: new Date() },
      },
      data: {
        password: passwordHash,
        mustChangePassword: false,
        temporaryPasswordExpiresAt: null,
        sessionVersion: { increment: 1 },
        loginAttempts: 0,
        loginWindowStartedAt: null,
      },
    });
    if (!changed.count) throw new Error('RESET_REQUEST_CHANGED');

    await tx.$executeRawUnsafe(
      `UPDATE app_internal.password_reset_request
       SET status='COMPLETED', completed_at=now(), updated_at=now()
       WHERE id=$1`,
      reset.id,
    );
  }, { isolationLevel: 'Serializable' });
}
