import { NextRequest, NextResponse } from 'next/server';
import { getCandidate } from '@/lib/ashby/client';

export async function GET(
  _req: NextRequest,
  { params }: { params: { candidateId: string } }
) {
  try {
    const candidate = await getCandidate(params.candidateId);
    return NextResponse.json({ candidate });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch candidate' }, { status: 500 });
  }
}
