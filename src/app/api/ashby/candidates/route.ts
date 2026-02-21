import { NextRequest, NextResponse } from 'next/server';
import { AshbyCandidate } from '@/types';

const ASHBY_API_BASE = 'https://api.ashbyhq.com';

type AppResult = {
  id: string;
  status: string;
  candidate: {
    id: string;
    name: string;
    primaryEmailAddress?: { value: string };
  };
  job?: { id: string; title: string };
  currentInterviewStage?: { id: string; title: string; orderInInterviewPlan?: number };
};

async function fetchAllApplicationsByStatus(
  status: string,
  jobId?: string
): Promise<AppResult[]> {
  const API_KEY = process.env.ASHBY_API_KEY!;
  const credentials = Buffer.from(`${API_KEY}:`).toString('base64');

  const post = (body: object) =>
    fetch(`${ASHBY_API_BASE}/application.list`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }).then((r) => r.json());

  const all: AppResult[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = { status, limit: 100 };
    if (jobId) body.jobId = jobId;
    if (cursor) body.cursor = cursor;

    const data = await post(body);
    if (!data.success) break; // status filter not supported or error — stop
    all.push(...(data.results ?? []));
    cursor = data.nextCursor;
  } while (cursor && all.length < 2000);

  return all;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId') ?? undefined;

    // Paginate through ALL Active and Lead applications independently (each has its own cursor)
    const [activeApps, leadApps] = await Promise.all([
      fetchAllApplicationsByStatus('Active', jobId),
      fetchAllApplicationsByStatus('Lead', jobId),
    ]);

    const allApps = [...activeApps, ...leadApps];

    // Deduplicate by candidate ID — keep application with most advanced stage
    const byCandidate = new Map<string, AppResult>();
    for (const app of allApps) {
      const cid = app.candidate.id;
      const existing = byCandidate.get(cid);
      if (!existing) {
        byCandidate.set(cid, app);
      } else {
        const existingOrder = existing.currentInterviewStage?.orderInInterviewPlan ?? -1;
        const newOrder = app.currentInterviewStage?.orderInInterviewPlan ?? -1;
        if (newOrder > existingOrder) byCandidate.set(cid, app);
      }
    }

    const candidates: AshbyCandidate[] = Array.from(byCandidate.values()).map((app) => ({
      id: app.candidate.id,
      name: app.candidate.name,
      email: app.candidate.primaryEmailAddress?.value ?? '',
      applicationId: app.id,
      jobTitle: app.job?.title,
      jobId: app.job?.id,
      currentStage: app.currentInterviewStage?.title,
      currentStageId: app.currentInterviewStage?.id,
    }));

    // Sort by stage order descending so furthest-along candidates appear first
    candidates.sort((a, b) => {
      const aOrder = allApps.find((x) => x.id === a.applicationId)?.currentInterviewStage?.orderInInterviewPlan ?? 0;
      const bOrder = allApps.find((x) => x.id === b.applicationId)?.currentInterviewStage?.orderInInterviewPlan ?? 0;
      return bOrder - aOrder;
    });

    return NextResponse.json({ candidates, total: candidates.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch candidates' }, { status: 500 });
  }
}
