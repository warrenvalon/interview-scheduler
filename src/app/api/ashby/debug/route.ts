import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const API_KEY = process.env.ASHBY_API_KEY!;
  const credentials = Buffer.from(`${API_KEY}:`).toString('base64');
  const { searchParams } = new URL(req.url);
  const candidateId = searchParams.get('candidateId'); // optional: look up specific candidate

  const post = (endpoint: string, body: object) =>
    fetch(`https://api.ashbyhq.com${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json());

  // Get a sample of applications to see the real structure
  const appList = await post('/application.list', { limit: 5 });
  const firstApp = appList?.results?.[0];

  // Get job status distribution
  const jobList = await post('/job.list', {});
  const statusCounts: Record<string, number> = {};
  for (const job of jobList?.results ?? []) {
    statusCounts[job.status] = (statusCounts[job.status] ?? 0) + 1;
  }

  // If candidateId provided, look up their applications
  let candidateApps = null;
  if (candidateId) {
    candidateApps = await post('/application.list', { candidateId });
  }

  // Also try to look up James Underwood directly by searching candidates
  const jamesSearch = await post('/candidate.list', { limit: 5 });

  return NextResponse.json({
    // Application.list structure
    application_list_first_keys: firstApp ? Object.keys(firstApp) : [],
    application_list_first_sample: firstApp,
    application_list_statuses: (appList?.results ?? []).map((a: Record<string, unknown>) => ({
      id: a.id,
      status: a.status,
      has_candidate_field: 'candidate' in a,
      has_candidateId_field: 'candidateId' in a,
      candidate_keys: a.candidate ? Object.keys(a.candidate as object) : null,
    })),
    application_total: appList?.results?.length,
    application_more: appList?.moreDataAvailable,

    // Job status breakdown
    job_status_distribution: statusCounts,
    total_jobs: jobList?.results?.length,

    // James search
    first_5_candidates: (jamesSearch?.results ?? []).map((c: Record<string, unknown>) => ({
      id: c.id,
      name: c.name,
      applicationIds: c.applicationIds,
    })),

    // Candidate-specific apps if candidateId provided
    candidate_apps: candidateApps,
  });
}
