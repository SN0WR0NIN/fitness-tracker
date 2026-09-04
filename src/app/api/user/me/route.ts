import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserProfileSettings, updateUserProfileSettings } from '@/lib/user-profile-settings';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const [user, settings] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          column: { select: { id: true, name: true } },
          stravaAthleteId: true,
        },
      }),
      getUserProfileSettings(session.user.id),
    ]);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      column: user.column,
      stravaConnected: !!user.stravaAthleteId,
      weeklyGoal: settings?.weeklyGoal ?? null,
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json() as { name?: unknown; weeklyGoal?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
    const weeklyGoal = typeof body.weeklyGoal === 'number' ? body.weeklyGoal : Number(body.weeklyGoal);

    if (name.length < 2 || name.length > 60) {
      return NextResponse.json({ error: 'Display name must be between 2 and 60 characters.' }, { status: 400 });
    }
    if (!Number.isFinite(weeklyGoal) || weeklyGoal < 5 || weeklyGoal > 500) {
      return NextResponse.json({ error: 'Weekly target must be between 5 and 500 points.' }, { status: 400 });
    }

    await updateUserProfileSettings(session.user.id, name, Math.round(weeklyGoal * 10) / 10);

    return NextResponse.json({
      message: 'Profile updated.',
      name,
      weeklyGoal: Math.round(weeklyGoal * 10) / 10,
    });
  } catch (error) {
    console.error('Error updating current user:', error);
    return NextResponse.json({ error: 'Failed to update profile.' }, { status: 500 });
  }
}
