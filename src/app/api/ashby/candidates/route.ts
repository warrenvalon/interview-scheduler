import { NextRequest, NextResponse } from 'next/server';
import { listCandidates } from '@/lib/ashby/client';
import { AshbyCandidate } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId') ?? undefined;

    // Paginate through all candidates
    const allCandidates: AshbyCandidate[] = [];
    let cursor: string | undefined;

    do {
      const data = await listCandidates({ jobId, cursor, limit: 100 });
      allCandidates.push(...data.candidates);
      cursor = data.nextCursor;
    } while (cursor && allCandidates.length < 2000); // safety cap

    return NextResponse.json({ candidates: allCandidates });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch candidates' }, { status: 500 });
  }
}
