import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { activatePlannedSeason, createPlannedSeason, getActiveSeason, getSeasons, seasonPhase } from '@/lib/seasons';
import { getWeekFinalizationStates, seasonWeekCount } from '@/lib/week-finalization';

export const dynamic='force-dynamic';
const CreateSchema=z.object({action:z.literal('create'),challengeName:z.string().trim().min(3).max(120),startDate:z.string().datetime(),endDate:z.string().datetime(),weeklyGoal:z.number().positive().max(10000)});
const ActivateSchema=z.object({action:z.literal('activate'),seasonKey:z.string().min(8).max(40)});
const BodySchema=z.discriminatedUnion('action',[CreateSchema,ActivateSchema]);

export async function GET(){const guard=await requireAdmin();if(guard.error)return NextResponse.json({error:guard.error},{status:guard.status});try{const [seasons,active]=await Promise.all([getSeasons(),getActiveSeason()]);const locks=await getWeekFinalizationStates(active);return NextResponse.json({activeSeasonKey:active.seasonKey,seasons:seasons.map(season=>({...season,phase:seasonPhase(season),weekCount:seasonWeekCount(season),finalizedWeeks:season.seasonKey===active.seasonKey?locks.filter(lock=>lock.status==='FINALIZED').length:null}))},{headers:{'Cache-Control':'private, no-store'}});}catch(error){console.error('Unable to load seasons:',error);return NextResponse.json({error:'Unable to load seasons.'},{status:500});}}

export async function POST(request:NextRequest){const guard=await requireAdmin();if(guard.error)return NextResponse.json({error:guard.error},{status:guard.status});try{const body=BodySchema.parse(await request.json());if(body.action==='create'){const season=await createPlannedSeason({challengeName:body.challengeName,startDate:new Date(body.startDate),endDate:new Date(body.endDate),weeklyGoal:body.weeklyGoal},guard.userId);return NextResponse.json({ok:true,season});}const season=await activatePlannedSeason(body.seasonKey,guard.userId);return NextResponse.json({ok:true,season});}catch(error){const message=error instanceof Error?error.message:'Unable to update seasons.';return NextResponse.json({error:message},{status:400});}}
