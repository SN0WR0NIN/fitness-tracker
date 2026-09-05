import { PrismaAdapter } from '@next-auth/prisma-adapter';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { verifyCredentials } from '@/lib/account-credentials';
import { prisma } from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await verifyCredentials(credentials.email, credentials.password);
        if (!user) return null;
        if (user.mustChangePassword) throw new Error('SETUP_REQUIRED');
        await prisma.user.update({ where: { id: user.id }, data: { loginAttempts: 0 } });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.sessionVersion = (user as { sessionVersion?: number }).sessionVersion ?? 0;
      }
      return token;
    },
    async session({ session, token }) {
      const current = typeof token.id === 'string' ? await prisma.user.findUnique({ where: { id: token.id }, select: { sessionVersion: true, mustChangePassword: true, role: true } }) : null;
      if (!current || current.mustChangePassword || current.sessionVersion !== (token.sessionVersion ?? 0)) return { ...session, user: undefined };
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = current.role;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
