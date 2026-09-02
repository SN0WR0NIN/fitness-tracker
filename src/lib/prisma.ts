let prismaClient: any = null;

function getPrismaClient() {
  if (prismaClient) {
    return prismaClient;
  }

  try {
    const { PrismaClient } = require('@prisma/client');
    prismaClient = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    });
  } catch (error) {
    console.error('Failed to initialize Prisma client:', error);
    throw new Error(
      'Prisma client not initialized. Make sure DATABASE_URL is set and migrations are run.'
    );
  }

  return prismaClient;
}

export const prisma = new Proxy({}, {
  get: (target, prop) => {
    const client = getPrismaClient();
    return client[prop];
  },
}) as any;
