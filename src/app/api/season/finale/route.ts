import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSeasonFinale } from '@/lib/season-finale';

export const dynamic='force-dynamic';

export async function GET(request:NextRequest){
  try{
    const session=await getServerSession(authOptions);
    const seasonKey=request.nextUrl.searchParams.get('season')||undefined;
    const finale=await getSeasonFinale(seasonKey,session?.user?.id??null);
    return NextResponse.json(finale,{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    console.error('Unable to load season finale:',error);
    return NextResponse.json({error:'Unable to load season finale.'},{status:500});
  }
}
