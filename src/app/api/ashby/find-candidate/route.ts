import { NextRequest, NextResponse } from 'next/server';

function ashbyPost(endpoint: string, body: object) {
  const credentials = Buffer.from(`${process.env.ASHBY_API_KEY!}:`).toString('base64');
  return fetch(`https://api.ashbyhq.com${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json());
}

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'Email or Ashby URL required' }, { status: 400 });

  const input = email.trim();

  // Strategy 1: Extract candidate ID specifically from Ashby URL pattern /candidates/UUID
  const ashbyCandidateMatch = input.match(/\/candidates\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  // Also grab application ID if present in URL
  const ashbyAppMatch = input.match(/\/applications\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);

  if (ashbyCandidateMatch) {
    const candidateId = ashbyCandidateMatch[1];
    const applicationId = ashbyAppMatch?.[1];
    const res = await ashbyPost('/candidate.info', { id: candidateId });
    if (res.success && res.results?.id) {
      return NextResponse.json(await buildResult(res.results, applicationId));
    }
  }

  // Strategy 1b: bare UUID pasted directly
  const bareUuid = input.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  if (bareUuid) {
    const res = await ashbyPost('/candidate.info', { id: input });
    if (res.success && res.results?.id) {
      return NextResponse.json(await buildResult(res.results));
    }
  }

  // Strategy 2: Ashby native search by email
  const normalizedEmail = input.toLowerCase();
  try {
    const res = await ashbyPost('/candidate.search', { email: normalizedEmail });
    if (res.success && res.results?.id) {
      return NextResponse.json(await buildResult(res.results));
    }
  } catch { /* try next */ }

  // Strategy 3: scan application.list for email match (checks primaryEmailAddress on each app)
  let cursor: string | undefined;
  for (let page = 0; page < 100; page++) {
    const body: Record<string, unknown> = { limit: 100 };
    if (cursor) body.cursor = cursor;
    const data = await ashbyPost('/application.list', body);
    if (!data.success || !data.results?.length) break;

    const match = data.results.find(
      (a: { candidate?: { primaryEmailAddress?: { value: string } } }) =>
        a.candidate?.primaryEmailAddress?.value?.toLowerCase() === normalizedEmail
    );

    if (match) {
      // Build result from the application directly
      const app = match as {
        candidate: { id: string; name: string; primaryEmailAddress?: { value: string } };
        id: string;
        status: string;
        job?: { id: string; title: string };
        currentInterviewStage?: { id: string; title: string };
      };
      return NextResponse.json({
        candidateId: app.candidate.id,
        name: app.candidate.name,
        email: app.candidate.primaryEmailAddress?.value ?? '',
        applicationId: app.id,
        jobTitle: app.job?.title,
        jobId: app.job?.id,
        currentStage: app.currentInterviewStage?.title,
        currentStageId: app.currentInterviewStage?.id,
      });
    }

    cursor = data.nextCursor;
    if (!cursor) break;
  }

  return NextResponse.json({ error: 'No candidate found. Try pasting their Ashby profile URL instead.' }, { status: 404 });
}

async function buildResult(
  candidate: {
    id: string;
    name: string;
    emailAddresses?: Array<{ value: string }>;
    primaryEmailAddress?: { value: string };
    applicationIds?: string[];
  },
  specificApplicationId?: string
) {
  type AppShape = {
    id: string;
    status: string;
    job?: { id: string; title: string };
    currentInterviewStage?: { id: string; title: string };
  };

  // If we have a specific application ID (from the URL), use it directly
  if (specificApplicationId) {
    const appRes = await ashbyPost('/application.info', { id: specificApplicationId });
    if (appRes.success && appRes.results) {
      const r = appRes.results;
      return {
        candidateId: candidate.id,
        name: candidate.name,
        email: candidate.primaryEmailAddress?.value ?? candidate.emailAddresses?.[0]?.value ?? '',
        applicationId: specificApplicationId,
        jobTitle: r.job?.title,
        jobId: r.job?.id,
        currentStage: r.currentInterviewStage?.title,
        currentStageId: r.currentInterviewStage?.id,
      };
    }
  }

  // Otherwise find their best active application
  const appsRes = await ashbyPost('/application.list', { candidateId: candidate.id, limit: 50 });
  const apps: AppShape[] = appsRes.results ?? [];

  const app =
    apps.find((a) => a.status === 'Active') ??
    apps.find((a) => a.status === 'Lead') ??
    apps.find((a) => a.status !== 'Hired' && a.status !== 'Archived') ??
    apps[0];

  return {
    candidateId: candidate.id,
    name: candidate.name,
    email: candidate.primaryEmailAddress?.value ?? candidate.emailAddresses?.[0]?.value ?? '',
    applicationId: app?.id,
    jobTitle: app?.job?.title,
    jobId: app?.job?.id,
    currentStage: app?.currentInterviewStage?.title,
    currentStageId: app?.currentInterviewStage?.id,
  };
}
