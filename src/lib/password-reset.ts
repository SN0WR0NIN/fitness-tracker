import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { ContactEmailSchema, NewPasswordSchema } from '@/lib/account-credentials';
import { recordAdminAudit } from '@/lib/admin-control';
import { sendPasswordResetEmail } from '@/lib/password-reset-email';
import { prisma } from '@/lib/prisma';

export type PasswordResetStatus = 'OPEN' | 'ISSUED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

type ActiveResetRow = {
  id: string;
  status: PasswordResetStatus;
  lastRequestedAt: Date;
  expiresAt: Date | null;
  emailSentAt: Date | null;
  tokenHash: string | null;
};
type IdRow = { id: string };
type CountRow = { count: bigint };
type TokenResetRow = { id: string; userId: string; password: string };
type ResetRecipient = { id: string; name: string; email: string };

export type PasswordResetRequest = {
  id: string;
  userId: string;
  status: PasswordResetStatus;
  requestCount: number;
  requestedAt: Date;
  lastRequestedAt: Date;
  issuedAt: Date | null;
  expiresAt: Date | null;
  emailSentAt: Date | null;
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

const RESET_TTL_MS = 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 15 * 60 * 1000;

function hashResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function expireStalePasswordResets() {
  await prisma.$executeRawUnsafe(`
    UPDATE app_internal.password_reset_request
    SET status='EXPIRED', updated_at=now()
    WHERE status='ISSUED' AND expires_at IS NOT NULL AND expires_at <= now()
  `);
}

async function createAndSendPasswordReset(
  user: ResetRecipient,
  options: { issuedById?: string; issuedByName?: string; respectCooldown: boolean },
) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  const requestId = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$queryRawUnsafe(`SELECT id FROM public."User" WHERE id=$1 FOR UPDATE`, user.id);
    const rows = await tx.$queryRawUnsafe(
      `SELECT id,status,last_requested_at AS "lastRequestedAt",expires_at AS "expiresAt",
              email_sent_at AS "emailSentAt",token_hash AS "tokenHash"
       FROM app_internal.password_reset_request
       WHERE user_id=$1 AND status IN ('OPEN','ISSUED')
       ORDER BY created_at DESC
       FOR UPDATE`,
      user.id,
    ) as ActiveResetRow[];

    const active = rows[0] ?? null;
    const activeIsFresh = Boolean(
      active?.status === 'ISSUED'
      && active.tokenHash
      && active.emailSentAt
      && active.expiresAt
      && active.expiresAt.getTime() > Date.now(),
    );
    if (options.respectCooldown && activeIsFresh && Date.now() - active.lastRequestedAt.getTime() < RESEND_COOLDOWN_MS) {
      await tx.$executeRawUnsafe(
        `UPDATE app_internal.password_reset_request SET request_count=request_count+1,updated_at=now() WHERE id=$1::uuid`,
        active!.id,
      );
      return null;
    }

    await tx.$executeRawUnsafe(
      `UPDATE app_internal.password_reset_request
       SET status=CASE WHEN expires_at IS NOT NULL AND expires_at <= now() THEN 'EXPIRED' ELSE 'CANCELLED' END,
           cancelled_at=CASE WHEN expires_at IS NULL OR expires_at > now() THEN now() ELSE cancelled_at END,
           updated_at=now()
       WHERE user_id=$1 AND status IN ('OPEN','ISSUED')`,
      user.id,
    );

    const inserted = await tx.$queryRawUnsafe(
      `INSERT INTO app_internal.password_reset_request(
         user_id,status,token_hash,requested_at,last_requested_at,issued_at,expires_at,issued_by_id,issued_by_name
       ) VALUES ($1,'ISSUED',$2,now(),now(),now(),$3,$4,$5)
       RETURNING id`,
      user.id,
      tokenHash,
      expiresAt,
      options.issuedById ?? null,
      options.issuedByName ?? null,
    ) as IdRow[];
    if (!inserted[0]) throw new Error('RESET_REQUEST_CREATE_FAILED');
    return inserted[0].id;
  }, { isolationLevel: 'Serializable' });

  if (!requestId) return { sent: false as const, throttled: true as const };

  try {
    await prisma.$executeRawUnsafe(
      `UPDATE app_internal.password_reset_request
       SET email_sent_at=now(),updated_at=now()
       WHERE id=$1::uuid AND status='ISSUED'`,
      requestId,
    );
    const deliveryId = await sendPasswordResetEmail({
      requestId,
      recipient: user.email,
      participantName: user.name,
      token,
    });
    await prisma.$executeRawUnsafe(
      `UPDATE app_internal.password_reset_request
       SET delivery_id=$2,updated_at=now()
       WHERE id=$1::uuid AND status='ISSUED'`,
      requestId,
      deliveryId,
    );
    return { sent: true as const, requestId };
  } catch (error) {
    await prisma.$executeRawUnsafe(
      `UPDATE app_internal.password_reset_request
       SET status='CANCELLED',cancelled_at=now(),updated_at=now()
       WHERE id=$1::uuid AND status='ISSUED'`,
      requestId,
    );
    throw error;
  }
}

export async function requestPasswordReset(email: string) {
  const parsedEmail = ContactEmailSchema.safeParse(email);
  if (!parsedEmail.success) return;

  const users = await prisma.user.findMany({
    where: {
      email: { equals: parsedEmail.data, mode: 'insensitive' },
      role: { in: ['MEMBER', 'ADMIN'] },
      password: { not: '!UNCLAIMED' },
    },
    select: { id: true, name: true, email: true },
    take: 2,
  });
  if (users.length !== 1) return;
  await createAndSendPasswordReset(users[0], { respectCooldown: true });
}

export async function sendPasswordResetForUser(userId: string, adminId: string) {
  const [user, admin] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, role: { in: ['MEMBER', 'ADMIN'] }, password: { not: '!UNCLAIMED' } },
      select: { id: true, name: true, email: true },
    }),
    prisma.user.findUnique({ where: { id: adminId }, select: { id: true, name: true } }),
  ]);
  if (!user || !ContactEmailSchema.safeParse(user.email).success) throw new Error('RESET_EMAIL_UNAVAILABLE');
  if (!admin) throw new Error('ADMIN_NOT_FOUND');

  const result = await createAndSendPasswordReset(user, {
    issuedById: admin.id,
    issuedByName: admin.name,
    respectCooldown: false,
  });
  await recordAdminAudit(admin.id, 'PASSWORD_RESET_EMAIL_SENT', user.id, {
    requestId: result.requestId,
    recipient: user.email,
  });
  return result;
}

export async function validatePasswordResetToken(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id FROM app_internal.password_reset_request
     WHERE token_hash=$1 AND status='ISSUED' AND email_sent_at IS NOT NULL AND expires_at > now()
     LIMIT 1`,
    hashResetToken(token),
  ) as IdRow[];
  return rows.length === 1;
}

export async function completePasswordReset(token: string, newPassword: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('INVALID_RESET_TOKEN');
  const parsedNewPassword = NewPasswordSchema.parse(newPassword);
  const tokenHash = hashResetToken(token);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT r.id,r.user_id AS "userId",u.password
     FROM app_internal.password_reset_request r
     JOIN public."User" u ON u.id=r.user_id
     WHERE r.token_hash=$1 AND r.status='ISSUED' AND r.email_sent_at IS NOT NULL AND r.expires_at > now()
     LIMIT 1`,
    tokenHash,
  ) as TokenResetRow[];
  const reset = rows[0];
  if (!reset) throw new Error('INVALID_RESET_TOKEN');
  if (await bcrypt.compare(parsedNewPassword, reset.password)) throw new Error('PASSWORD_REUSE');
  const passwordHash = await bcrypt.hash(parsedNewPassword, 12);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const locked = await tx.$queryRawUnsafe(
      `SELECT r.id,r.user_id AS "userId",u.password
       FROM app_internal.password_reset_request r
       JOIN public."User" u ON u.id=r.user_id
       WHERE r.id=$1::uuid AND r.token_hash=$2 AND r.status='ISSUED' AND r.email_sent_at IS NOT NULL AND r.expires_at > now()
       FOR UPDATE OF r,u`,
      reset.id,
      tokenHash,
    ) as TokenResetRow[];
    if (!locked[0] || locked[0].password !== reset.password) throw new Error('INVALID_RESET_TOKEN');

    const changed = await tx.user.updateMany({
      where: { id: reset.userId, password: reset.password },
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

    await tx.$executeRawUnsafe(
      `UPDATE app_internal.password_reset_request
       SET status='COMPLETED',completed_at=now(),updated_at=now()
       WHERE id=$1::uuid`,
      reset.id,
    );
    await tx.$executeRawUnsafe(
      `UPDATE app_internal.password_reset_request
       SET status='CANCELLED',cancelled_at=now(),updated_at=now()
       WHERE user_id=$1 AND id<>$2::uuid AND status IN ('OPEN','ISSUED')`,
      reset.userId,
      reset.id,
    );
  }, { isolationLevel: 'Serializable' });
}

// Retained only for first-login credentials created before this email-link flow.
export async function hasIssuedPasswordReset(userId: string) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id FROM app_internal.password_reset_request
     WHERE user_id=$1 AND status='ISSUED' AND token_hash IS NULL AND expires_at > now()
     ORDER BY issued_at DESC LIMIT 1`,
    userId,
  ) as IdRow[];
  return rows.length > 0;
}

export async function getPasswordResetRequests(): Promise<PasswordResetRequest[]> {
  await expireStalePasswordResets();
  return await prisma.$queryRawUnsafe(`
    SELECT
      r.id,
      r.user_id AS "userId",
      r.status,
      r.request_count AS "requestCount",
      r.requested_at AS "requestedAt",
      r.last_requested_at AS "lastRequestedAt",
      r.issued_at AS "issuedAt",
      r.expires_at AS "expiresAt",
      r.email_sent_at AS "emailSentAt",
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
    WHERE r.token_hash IS NOT NULL
    ORDER BY
      CASE r.status WHEN 'ISSUED' THEN 0 ELSE 1 END,
      r.last_requested_at DESC
    LIMIT 150
  `) as PasswordResetRequest[];
}

export async function getActivePasswordResetCount() {
  await expireStalePasswordResets();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT count(*)::bigint AS count
     FROM app_internal.password_reset_request
     WHERE status='ISSUED' AND token_hash IS NOT NULL AND email_sent_at IS NOT NULL AND expires_at > now()`,
  ) as CountRow[];
  return Number(rows[0]?.count ?? 0);
}
