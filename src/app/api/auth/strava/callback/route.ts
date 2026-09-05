import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { STRAVA_INTEGRATION_ENABLED } from '@/lib/features';

export async function GET(request: NextRequest) {
  try {
    if (!STRAVA_INTEGRATION_ENABLED) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL('/dashboard?stravaError=access_denied', request.url)
      );
    }

    const expectedState = request.cookies.get('strava_oauth_state')?.value;
    if (!code || !state || !expectedState || state !== expectedState) {
      return NextResponse.redirect(
        new URL('/dashboard?stravaError=invalid_state', request.url)
      );
    }

    // Exchange code for access token
    const tokenResponse = await axios.post('https://www.strava.com/oauth/token', {
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    });

    const { athlete, access_token, refresh_token, expires_at } = tokenResponse.data;

    // Link the Strava account to the currently logged-in user (never trust athlete.email —
    // Strava's API does not return the athlete's email address)
    const existingLink = await prisma.user.findUnique({
      where: { stravaAthleteId: athlete.id.toString() },
    });
    if (existingLink && existingLink.id !== session.user.id) {
      return NextResponse.redirect(
        new URL('/dashboard?stravaError=already_linked', request.url)
      );
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        stravaAthleteId: athlete.id.toString(),
        stravaAccessToken: access_token,
        stravaRefreshToken: refresh_token,
        stravaTokenExpiresAt: new Date(expires_at * 1000),
      },
    });

    const redirectUrl = new URL('/dashboard', request.url);
    redirectUrl.searchParams.set('stravaConnected', 'true');

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete('strava_oauth_state');

    return response;
  } catch (error) {
    console.error('Error handling Strava callback:', error);
    return NextResponse.redirect(
      new URL('/dashboard?stravaError=connection_failed', request.url)
    );
  }
}
