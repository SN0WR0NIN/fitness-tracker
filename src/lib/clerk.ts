export const clerkPublishableKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_AUTHENTICATION_CLERK_PUBLISHABLE_KEY;

export const clerkSecretKey =
  process.env.CLERK_SECRET_KEY ??
  process.env.AUTHENTICATION_CLERK_SECRET_KEY;

export const clerkConfigured = Boolean(clerkPublishableKey && clerkSecretKey);
