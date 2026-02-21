import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const API_KEY = process.env.ASHBY_API_KEY!;
  const credentials = Buffer.from(`${API_KEY}:`).toString('base64');
  const { searchParams } = new URL(req.url);
  const candidateId = searchParams.get('candidateId');

  const post = (endpoint: string, body: object) =>
    fetch(`https://api.ashbyhq.com${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json());

  // Count how many pages of each status exist
  const [activeFirst, leadFirst] = await Promise.all([
    post('/application.list', { limit: 5, status: 'Active' }),
    post('/application.list', { limit: 5, status: 'Lead' }),
  ]);

  // If candidateId provided, look up all their applications directly
  let candidateApps = null;
  if (candidateId) {
    candidateApps = await post('/application.list', { candidateId, limit: 50 });
  }

  return NextResponse.json({
    active: {
      sample: (activeFirst?.results ?? []).map((a: Record<string, unknown>) => ({
        name: (a.candidate as Record<string, unknown>)?.name,
        status: a.status,
        stage: (a.currentInterviewStage as Record<string, unknown>)?.title,
        job: (a.job as Record<string, unknown>)?.title,
        stageOrder: (a.currentInterviewStage as Record<string, unknown>)?.orderInInterviewPlan,
      })),
      hasMore: activeFirst?.moreDataAvailable,
      total_in_page: activeFirst?.results?.length,
    },
    lead: {
      sample: (leadFirst?.results ?? []).map((a: Record<string, unknown>) => ({
        name: (a.candidate as Record<string, unknown>)?.name,
        status: a.status,
        stage: (a.currentInterviewStage as Record<string, unknown>)?.title,
        job: (a.job as Record<string, unknown>)?.title,
      })),
      hasMore: leadFirst?.moreDataAvailable,
      total_in_page: leadFirst?.results?.length,
    },
    candidate_apps: candidateApps
      ? (candidateApps?.results ?? []).map((a: Record<string, unknown>) => ({
          applicationId: a.id,
          status: a.status,
          stage: (a.currentInterviewStage as Record<string, unknown>)?.title,
          stageType: (a.currentInterviewStage as Record<string, unknown>)?.type,
          job: (a.job as Record<string, unknown>)?.title,
        }))
      : null,
    hint: candidateId ? '' : 'Add ?candidateId=<id> to see all applications for a candidate',
  });
}
