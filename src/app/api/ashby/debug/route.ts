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

  // 18-month cutoff — same as the candidates route uses
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 18);
  const createdAfterDate = cutoff.toISOString();

  const [activeRecent, activeAll] = await Promise.all([
    post('/application.list', { limit: 10, status: 'Active', createdAfterDate }),
    post('/application.list', { limit: 5, status: 'Active' }), // without filter for comparison
  ]);

  // If candidateId provided, look up all their applications
  let candidateApps = null;
  if (candidateId) {
    candidateApps = await post('/application.list', { candidateId, limit: 50 });
  }

  return NextResponse.json({
    cutoff_date: createdAfterDate,
    active_with_date_filter: {
      count: activeRecent?.results?.length,
      hasMore: activeRecent?.moreDataAvailable,
      sample: (activeRecent?.results ?? []).map((a: Record<string, unknown>) => ({
        name: (a.candidate as Record<string, unknown>)?.name,
        stage: (a.currentInterviewStage as Record<string, unknown>)?.title,
        job: (a.job as Record<string, unknown>)?.title,
        createdAt: a.createdAt,
      })),
    },
    active_without_filter_oldest_first: (activeAll?.results ?? []).map((a: Record<string, unknown>) => ({
      name: (a.candidate as Record<string, unknown>)?.name,
      job: (a.job as Record<string, unknown>)?.title,
      createdAt: a.createdAt,
    })),
    candidate_apps: candidateApps
      ? (candidateApps?.results ?? []).map((a: Record<string, unknown>) => ({
          applicationId: a.id,
          status: a.status,
          stage: (a.currentInterviewStage as Record<string, unknown>)?.title,
          job: (a.job as Record<string, unknown>)?.title,
          createdAt: a.createdAt,
        }))
      : null,
    hint: candidateId ? '' : 'Add ?candidateId=<uuid> to look up a specific candidate\'s applications',
  });
}
