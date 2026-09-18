import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Account setup is now managed by the shared Clerk sign-in.' },
    { status: 410 },
  );
}
