import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { DecideCorrectionSchema,decideCorrection,listCorrections } from '@/lib/activity-corrections';
import { requireSameOrigin } from '@/lib/operating-mode';
import { featureErrorResponse } from '@/lib/feature-response';

export async function GET(request:Request) {
  const guard=await requireAdmin();
  if (guard.error) return NextResponse.json({error:guard.error},{status:guard.status});
  try {return NextResponse.json(await listCorrections(null,new URL(request.url).searchParams.get('history')==='true'),{headers:{'Cache-Control':'no-store'}});} catch(error){return featureErrorResponse(error);}
}
export async function POST(request:Request) {
  const guard=await requireAdmin();
  if (guard.error) return NextResponse.json({error:guard.error},{status:guard.status});
  try {
    requireSameOrigin(request);
    const result=await decideCorrection(guard.userId,DecideCorrectionSchema.parse(await request.json()));
    return NextResponse.json(result,{status:result.status==='STALE'?409:200});
  } catch(error){return featureErrorResponse(error);}
}
