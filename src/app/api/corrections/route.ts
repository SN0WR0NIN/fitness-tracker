import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/auth';
import { z } from 'zod';
import { CreateCorrectionSchema,createCorrection,listCorrections,cancelCorrection } from '@/lib/activity-corrections';
import { requireSameOrigin } from '@/lib/operating-mode';
import { featureErrorResponse } from '@/lib/feature-response';

export async function GET() {
  const session=await getAppSession();
  if (!session?.user?.id) return NextResponse.json({error:'Not authenticated'},{status:401});
  try {return NextResponse.json(await listCorrections(session.user.id),{headers:{'Cache-Control':'no-store'}});} catch(error){return featureErrorResponse(error);}
}
export async function POST(request:Request) {
  const session=await getAppSession();
  if (!session?.user?.id) return NextResponse.json({error:'Not authenticated'},{status:401});
  try {requireSameOrigin(request);return NextResponse.json(await createCorrection(session.user.id,CreateCorrectionSchema.parse(await request.json())),{status:201});} catch(error){return featureErrorResponse(error);}
}
export async function PATCH(request:Request) {
  const session=await getAppSession();
  if (!session?.user?.id) return NextResponse.json({error:'Not authenticated'},{status:401});
  try {requireSameOrigin(request);const data=z.object({id:z.string().uuid(),action:z.literal('cancel')}).strict().parse(await request.json());return NextResponse.json(await cancelCorrection(session.user.id,data.id));} catch(error){return featureErrorResponse(error);}
}
