import { NextRequest, NextResponse } from 'next/server';
import { listCandidates } from '@/lib/ashby/client';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId') ?? undefined;
    const cursor = searchParams.get('cursor') ?? undefined;

    const data = await listCandidates({ jobId, cursor, limit: 50 });
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch candidates' }, { status: 500 });
  }
}
