import { auth, currentUser } from '@clerk/nextjs/server';
import type { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';

export type AppSession = {
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
};

async function resolveAppUser(clerkUserId: string) {
  const linked = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (linked) return linked;

  const identity = await currentUser();
  const primaryEmail = identity?.emailAddresses.find(
    (address) => address.id === identity.primaryEmailAddressId,
  );
  if (!identity || !primaryEmail || primaryEmail.verification?.status !== 'verified') return null;

  const email = primaryEmail.emailAddress.trim().toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, clerkUserId: true },
  });

  if (existing?.clerkUserId && existing.clerkUserId !== clerkUserId) return null;
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { clerkUserId, emailConfirmedAt: new Date() },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  const fallbackName = [identity.firstName, identity.lastName].filter(Boolean).join(' ') || email.split('@')[0];
  const retiredCredential = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
  return prisma.user.create({
    data: {
      clerkUserId,
      email,
      emailConfirmedAt: new Date(),
      name: fallbackName,
      password: retiredCredential,
    },
    select: { id: true, name: true, email: true, role: true },
  });
}

export async function getAppSession(): Promise<AppSession | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;
  const user = await resolveAppUser(clerkUserId);
  return user ? { user } : null;
}
