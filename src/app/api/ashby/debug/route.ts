import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const API_KEY = process.env.ASHBY_API_KEY!;
  const credentials = Buffer.from(`${API_KEY}:`).toString('base64');
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');

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
  const openJobs = (jobs?.results ?? []).filter((j: { status: string }) => j.status === 'Open');

  let jobInfo = null;
  let interviewStages = null;
  const testJobId = jobId ?? openJobs[0]?.id;

  if (testJobId) {
    jobInfo = await post('/job.info', { id: testJobId });
    const planId = jobInfo?.results?.defaultInterviewPlanId ?? jobInfo?.results?.interviewPlanIds?.[0];
    if (planId) {
      interviewStages = await post('/interviewStage.list', { interviewPlanId: planId });
    }
  }

  return NextResponse.json({
    total_jobs: jobs?.results?.length ?? 0,
    open_jobs: openJobs.length,
    first_open_job: openJobs[0] ? { id: openJobs[0].id, title: openJobs[0].title } : null,
    candidate_count: candidates?.results?.length ?? 0,
    candidates_more: candidates?.moreDataAvailable,
    first_job_status: firstJob?.status,
    tested_job_id: testJobId,
    tested_job_title: jobInfo?.results?.title,
    plan_id: jobInfo?.results?.defaultInterviewPlanId,
    interview_stages: interviewStages,
  });
}
