import { NextResponse } from 'next/server';
import { getChallengeSettings } from '@/lib/admin-control';
export const dynamic='force-dynamic';
export async function GET(){try{
  const settings=await getChallengeSettings();const readOnlyMode='readOnlyMode' in settings&&settings.readOnlyMode===true;
  return NextResponse.json({challengeName:settings.challengeName,startDate:settings.startDate,endDate:settings.endDate,weeklyGoal:settings.weeklyGoal,maintenanceMode:settings.maintenanceMode||readOnlyMode,readOnlyMode,operatingMode:readOnlyMode?'READ_ONLY':settings.maintenanceMode?'PAUSED':'NORMAL',maintenanceMessage:settings.maintenanceMessage},{headers:{'Cache-Control':'no-store'}});
}catch(error){console.error('Unable to load challenge configuration:',error);return NextResponse.json({challengeName:'KG Stay Active Challenge'},{status:503,headers:{'Cache-Control':'no-store'}});}}
