import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { prisma } from '@/lib/prisma';
import { getActiveSeason } from '@/lib/seasons';
import { finalizeWeek, getWeekFinalizationStates, reopenWeek, weekWindow } from '@/lib/week-finalization';

export const dynamic='force-dynamic';
const ActionSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('finalize'),weekNumber:z.number().int().min(1).max(60),note:z.string().trim().max(500).optional()}),
  z.object({action:z.literal('reopen'),weekNumber:z.number().int().min(1).max(60),reason:z.string().trim().min(5).max(500)}),
]);

export async function GET(){
  const guard=await requireAdmin();if(guard.error)return NextResponse.json({error:guard.error},{status:guard.status});
  try{
    const season=await getActiveSeason();
    const states=await getWeekFinalizationStates(season);
    const counts=await prisma.$queryRawUnsafe(`
      SELECT "weekNumber",
        count(*) FILTER (WHERE status='PENDING')::int AS pending,
        count(*) FILTER (WHERE status='APPROVED')::int AS approved,
        count(*) FILTER (WHERE status='REJECTED')::int AS rejected
      FROM "Activity"
      WHERE "occurredAt">=$1 AND "occurredAt"<=$2
      GROUP BY "weekNumber"
    `,season.startDate,season.endDate) as Array<{weekNumber:number;pending:number;approved:number;rejected:number}>;
    const byWeek=new Map(counts.map(row=>[row.weekNumber,row]));
    const now=new Date();
    return NextResponse.json({season:{seasonKey:season.seasonKey,challengeName:season.challengeName,startDate:season.startDate,endDate:season.endDate},weeks:states.map(state=>{const count=byWeek.get(state.weekNumber)??{pending:0,approved:0,rejected:0};const window=weekWindow(season,state.weekNumber);return{...state,...count,canFinalize:now.getTime()>new Date(`${window.displayEnd.toISOString().slice(0,10)}T16:00:00Z`).getTime()&&state.status!=='FINALIZED'&&count.pending===0};})},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){console.error('Unable to load week finalization state:',error);return NextResponse.json({error:'Unable to load week finalization state.'},{status:500});}
}

export async function POST(request:NextRequest){
  const guard=await requireAdmin();if(guard.error)return NextResponse.json({error:guard.error},{status:guard.status});
  try{
    const body=ActionSchema.parse(await request.json());
    const result=body.action==='finalize'?await finalizeWeek(body.weekNumber,guard.userId,body.note??''):await reopenWeek(body.weekNumber,guard.userId,body.reason);
    return NextResponse.json({ok:true,result});
  }catch(error){const message=error instanceof Error?error.message:'Unable to update week status.';return NextResponse.json({error:message},{status:message.includes('not found')?404:400});}
}
