import { NextResponse } from 'next/server';
import { getChallengeSettings } from '@/lib/admin-control';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getChallengeSettings();
    return NextResponse.json({ challengeName: settings.challengeName, startDate: settings.startDate, endDate: settings.endDate, weeklyGoal: settings.weeklyGoal });
  } catch (error) {
    console.error('Unable to load challenge configuration:', error);
    return NextResponse.json({ challengeName: 'KG Stay Active Challenge' });
  }
}
