import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { FeatureError } from '@/lib/operating-mode';

export function featureErrorResponse(error: unknown) {
  if (error instanceof FeatureError) return NextResponse.json({error:error.message,details:error.details},{status:error.status});
  if (error instanceof ZodError) return NextResponse.json({error:error.issues[0]?.message ?? 'Invalid details'},{status:400});
  if (error instanceof SyntaxError) return NextResponse.json({error:'Invalid JSON request.'},{status:400});
  const known=error as {code?:string;meta?:{code?:string};message?:string};
  if (known?.meta?.code==='55000') return NextResponse.json({error:'Competition changes are locked. An administrator can unlock them in Maintenance controls.'},{status:423});
  if (known?.code==='P2002' || known?.meta?.code==='23505') return NextResponse.json({error:'An active request already exists. Reload and check its status.'},{status:409});
  console.error('Focused feature request failed:',known?.code ?? 'unknown');
  return NextResponse.json({error:'The change could not be completed. Reload and check its status before retrying.'},{status:500});
}
