import { NextResponse } from 'next/server';
import { getChallengeSettings } from '@/lib/admin-control';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getChallengeSettings();
    return NextResponse.json({ challengeName: settings.challengeName, startDate: settings.startDate, endDate: settings.endDate, weeklyGoal: settings.weeklyGoal, maintenanceMode: settings.maintenanceMode, maintenanceMessage: settings.maintenanceMessage }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unable to load challenge configuration:', error);
    return NextResponse.json({ challengeName: 'KG Stay Active Challenge' });
  }
}
