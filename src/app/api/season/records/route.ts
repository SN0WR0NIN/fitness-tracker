import { NextRequest, NextResponse } from 'next/server';
import { getSeasonRecords } from '@/lib/season-records';

export const dynamic='force-dynamic';

export async function GET(request: NextRequest){
  try{
    const seasonKey=request.nextUrl.searchParams.get('season')||undefined;
    const data=await getSeasonRecords(seasonKey);
    return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    console.error('Unable to load season records:',error);
    return NextResponse.json({error:'Unable to load season records.'},{status:500});
  }
}
