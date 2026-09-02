import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL('/auth/login?next=/api/auth/strava', request.url));
    }

    const clientId = process.env.STRAVA_CLIENT_ID;
    const redirectUri = process.env.STRAVA_REDIRECT_URI;
    const scope = 'activity:read_all';

    // CSRF protection: verified against a matching cookie in the callback
    const state = randomBytes(16).toString('hex');

    const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;

    const response = NextResponse.redirect(stravaAuthUrl);
    response.cookies.set('strava_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
    });

    return response;
  } catch (error) {
    console.error('Error initiating Strava auth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate authentication' },
      { status: 500 }
    );
  }
}
