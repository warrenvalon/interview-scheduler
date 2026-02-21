import { NextResponse } from 'next/server';

function ashbyPost(endpoint: string, body: object) {
  const credentials = Buffer.from(`${process.env.ASHBY_API_KEY!}:`).toString('base64');
  return fetch(`https://api.ashbyhq.com${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json());
}

// James Underwood's known IDs from Ashby URL
const JAMES_CANDIDATE_ID = '6c1af580-d15e-44c1-b05c-45b9f1659c2b';
const JAMES_APP_ID = '5d14480f-3ee8-42c1-8ab5-3dfb69a4ddc0';

export async function GET() {
  const [candidateInfo, appInfo, appList] = await Promise.all([
    ashbyPost('/candidate.info', { id: JAMES_CANDIDATE_ID }),
    ashbyPost('/application.info', { id: JAMES_APP_ID }),
    ashbyPost('/application.list', { candidateId: JAMES_CANDIDATE_ID, limit: 20 }),
  ]);

  return NextResponse.json({
    candidate_info: {
      success: candidateInfo.success,
      id: candidateInfo.results?.id,
      name: candidateInfo.results?.name,
      email: candidateInfo.results?.primaryEmailAddress?.value ?? candidateInfo.results?.emailAddresses?.[0]?.value,
      applicationIds: candidateInfo.results?.applicationIds,
      applicationIds_count: candidateInfo.results?.applicationIds?.length ?? 0,
    },
    application_info: {
      success: appInfo.success,
      id: appInfo.results?.id,
      status: appInfo.results?.status,
      stage: appInfo.results?.currentInterviewStage?.title,
      stageType: appInfo.results?.currentInterviewStage?.type,
      job: appInfo.results?.job?.title,
      jobId: appInfo.results?.job?.id,
      archivedAt: appInfo.results?.archivedAt,
    },
    application_list_for_candidate: {
      success: appList.success,
      count: appList.results?.length,
      apps: (appList.results ?? []).map((a: Record<string, unknown>) => ({
        id: a.id,
        status: a.status,
        stage: (a.currentInterviewStage as Record<string, unknown>)?.title,
        job: (a.job as Record<string, unknown>)?.title,
      })),
    },
  });
}
