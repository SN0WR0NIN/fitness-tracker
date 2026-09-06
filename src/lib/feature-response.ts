import { ActivityEditError } from '@/lib/activity-duplicates';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { FeatureError } from '@/lib/operating-mode';

export function featureErrorResponse(error: unknown) {
  if (error instanceof ActivityEditError) return NextResponse.json({error:error.message},{status:error.status});
  if (error instanceof FeatureError) return NextResponse.json({error:error.message,details:error.details},{status:error.status});
  if (error instanceof ZodError) return NextResponse.json({error:error.issues[0]?.message ?? 'Invalid details'},{status:400});
  if (error instanceof SyntaxError) return NextResponse.json({error:'Invalid JSON request.'},{status:400});
  const known=error as {code?:string;meta?:{code?:string};message?:string};
  if (known?.meta?.code==='55000') return NextResponse.json({error:'Competition changes are locked. An administrator can unlock them in Maintenance controls.'},{status:423});
  if (known?.code==='P2002' || known?.meta?.code==='23505') return NextResponse.json({error:'An active request already exists. Reload and check its status.'},{status:409});
  // Raw SELECT ... FOR UPDATE exposes PostgreSQL serialization conflicts as
  // P2010/meta 40001, not always Prisma's P2034. The losing transaction rolls
  // back; never turn a simultaneous review into a generic server failure.
  if (known?.code==='P2034' || (known?.code==='P2010' && ['40001','40P01'].includes(known.meta?.code ?? ''))) {
    return NextResponse.json({error:'This request changed in another session. Reload to see the current decision before retrying.'},{status:409});
  }
  console.error('Focused feature request failed:',known?.code ?? 'unknown');
  return NextResponse.json({error:'The change could not be completed. Reload and check its status before retrying.'},{status:500});
}
