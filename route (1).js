import{NextResponse}from"next/server";import{getWrMatchups}from"../../../../lib/wrMatchups";
export const dynamic="force-dynamic";
export async function GET(){try{return NextResponse.json(await getWrMatchups())}catch(e){return NextResponse.json({error:e.message||"Unable to build WR matchup board"},{status:500})}}
