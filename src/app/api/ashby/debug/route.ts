import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const API_KEY = process.env.ASHBY_API_KEY!;
  const credentials = Buffer.from(`${API_KEY}:`).toString('base64');
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');
  const planId = searchParams.get('planId');

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

  const firstJob = jobs?.results?.[0];

  // If jobId provided, get job info and its interview plan
  let jobInfo = null;
  let interviewPlan = null;
  if (jobId) {
    jobInfo = await post('/job.info', { id: jobId });
    const resolvedPlanId = planId
      ?? jobInfo?.results?.defaultInterviewPlanId
      ?? jobInfo?.results?.interviewPlanIds?.[0];
    if (resolvedPlanId) {
      interviewPlan = await post('/jobInterviewPlan.info', { id: resolvedPlanId });
    }
  }

  return NextResponse.json({
    total_jobs: jobs?.results?.length ?? 0,
    first_job_id: firstJob?.id,
    first_job_title: firstJob?.title,
    first_job_defaultInterviewPlanId: firstJob?.defaultInterviewPlanId,
    candidate_count: candidates?.results?.length ?? 0,
    candidates_more: candidates?.moreDataAvailable,
    ...(jobId ? {
      job_info_keys: jobInfo?.results ? Object.keys(jobInfo.results) : [],
      job_defaultInterviewPlanId: jobInfo?.results?.defaultInterviewPlanId,
      job_interviewPlanIds: jobInfo?.results?.interviewPlanIds,
      interview_plan_raw: interviewPlan,
    } : {
      hint: 'Add ?jobId=<job_id> to inspect interview stages for that job',
      first_job_id: firstJob?.id,
    }),
  });
}
