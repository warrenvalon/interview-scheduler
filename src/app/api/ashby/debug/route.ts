import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const API_KEY = process.env.ASHBY_API_KEY!;
  const credentials = Buffer.from(`${API_KEY}:`).toString('base64');
  const jobId = new URL(req.url).searchParams.get('jobId');

  const post = (endpoint: string, body: object) =>
    fetch(`https://api.ashbyhq.com${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json());

  const [jobs, candidates] = await Promise.all([
    post('/job.list', {}),
    post('/candidate.list', { limit: 3 }),
  ]);

  // If jobId provided, also test the interview plan endpoint
  let interviewPlanJobId = null;
  let interviewPlanId = null;
  let interviewStageList = null;
  if (jobId) {
    [interviewPlanJobId, interviewPlanId, interviewStageList] = await Promise.all([
      post('/jobInterviewPlan.info', { jobId }),
      post('/jobInterviewPlan.info', { id: jobId }),
      post('/interviewStage.list', { jobId }).catch(() => null),
    ]);
  }

  // Helper to show structure without full data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summarize = (obj: any, depth = 0): unknown => {
    if (depth > 4 || obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return `[Array(${obj.length})] first: ${JSON.stringify(summarize(obj[0], depth + 1))}`;
    if (typeof obj === 'object') {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(obj)) out[k] = summarize(obj[k], depth + 1);
      return out;
    }
    return obj;
  };

  return NextResponse.json({
    first_job: jobs?.results?.[0] ?? null,
    first_job_keys: jobs?.results?.[0] ? Object.keys(jobs.results[0]) : [],
    total_jobs: jobs?.results?.length ?? 0,
    first_candidate_keys: candidates?.results?.[0] ? Object.keys(candidates.results[0]) : [],
    candidate_count: candidates?.results?.length ?? 0,
    candidates_more: candidates?.moreDataAvailable,
    ...(jobId ? {
      interview_plan_jobId_param: summarize(interviewPlanJobId),
      interview_plan_id_param: summarize(interviewPlanId),
      interview_stage_list: summarize(interviewStageList),
    } : { hint: 'Add ?jobId=<id> to test interview stages' }),
  });
}
