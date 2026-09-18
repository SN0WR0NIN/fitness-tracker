import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/auth';
import { getNotificationPreferences,saveNotificationPreferences,NotificationPreferencesSchema } from '@/lib/notification-preferences';
import { requireSameOrigin } from '@/lib/operating-mode';
import { featureErrorResponse } from '@/lib/feature-response';
export async function GET(){
  const session=await getAppSession();if(!session?.user?.id)return NextResponse.json({error:'Not authenticated'},{status:401});
  try{return NextResponse.json(await getNotificationPreferences(session.user.id),{headers:{'Cache-Control':'no-store'}});}catch(error){return featureErrorResponse(error);}
}
export async function POST(request:Request){
  const session=await getAppSession();if(!session?.user?.id)return NextResponse.json({error:'Not authenticated'},{status:401});
  try{requireSameOrigin(request);const data=NotificationPreferencesSchema.parse(await request.json());return NextResponse.json(await saveNotificationPreferences(session.user.id,data),{headers:{'Cache-Control':'no-store'}});}catch(error){return featureErrorResponse(error);}
}
