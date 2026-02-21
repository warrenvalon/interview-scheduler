import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const API_KEY = process.env.ASHBY_API_KEY!;
  const credentials = Buffer.from(`${API_KEY}:`).toString('base64');
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email'); // e.g. ?email=jjl.underwood@gmail.com

  const post = (endpoint: string, body: object) =>
    fetch(`https://api.ashbyhq.com${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json());

  // Count applications by status
  const [activeApps, leadApps, archivedSample] = await Promise.all([
    post('/application.list', { limit: 5, status: 'Active' }),
    post('/application.list', { limit: 5, status: 'Lead' }),
    post('/application.list', { limit: 5, status: 'Archived' }),
  ]);

  // Look up a specific candidate by email if provided
  let candidateSearch = null;
  if (email) {
    candidateSearch = await post('/candidate.search', { email });
  }

  return NextResponse.json({
    active_apps_count: activeApps?.results?.length,
    active_apps_more: activeApps?.moreDataAvailable,
    active_sample: (activeApps?.results ?? []).map((a: Record<string, unknown>) => ({
      candidateName: (a.candidate as Record<string, unknown>)?.name,
      status: a.status,
      stage: (a.currentInterviewStage as Record<string, unknown>)?.title,
      job: (a.job as Record<string, unknown>)?.title,
    })),
    lead_apps_count: leadApps?.results?.length,
    lead_sample: (leadApps?.results ?? []).map((a: Record<string, unknown>) => ({
      candidateName: (a.candidate as Record<string, unknown>)?.name,
      status: a.status,
      stage: (a.currentInterviewStage as Record<string, unknown>)?.title,
      job: (a.job as Record<string, unknown>)?.title,
    })),
    archived_sample_statuses: (archivedSample?.results ?? []).map((a: Record<string, unknown>) => a.status),
    candidate_search: candidateSearch,
    hint: email ? '' : 'Add ?email=jjl.underwood@gmail.com to look up a specific candidate',
  });
}
