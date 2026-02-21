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
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  const normalizedEmail = email.trim().toLowerCase();

  // Strategy 1: Ashby candidate.search by email
  try {
    const res = await ashbyPost('/candidate.search', { email: normalizedEmail });
    if (res.success && res.results?.id) {
      return NextResponse.json(await buildResult(res.results));
    }
  } catch { /* try next */ }

  // Strategy 2: scan candidate.list comparing email addresses (up to 50 pages / 5000 candidates)
  let cursor: string | undefined;
  for (let page = 0; page < 50; page++) {
    const body: Record<string, unknown> = { limit: 100 };
    if (cursor) body.cursor = cursor;
    const data = await ashbyPost('/candidate.list', body);
    if (!data.success || !data.results?.length) break;

    const match = data.results.find((c: { emailAddresses?: Array<{ value: string }> }) =>
      c.emailAddresses?.some((e) => e.value.toLowerCase() === normalizedEmail)
    );

    if (match) return NextResponse.json(await buildResult(match));

    cursor = data.nextCursor;
    if (!cursor) break;
  }

  return NextResponse.json({ error: 'No candidate found with that email' }, { status: 404 });
}

async function buildResult(candidate: {
  id: string;
  name: string;
  emailAddresses?: Array<{ value: string }>;
  primaryEmailAddress?: { value: string };
  applicationIds?: string[];
}) {
  // Get their most recent non-hired/archived application
  const appsRes = await ashbyPost('/application.list', { candidateId: candidate.id, limit: 50 });
  const apps: Array<{
    id: string;
    status: string;
    job?: { id: string; title: string };
    currentInterviewStage?: { id: string; title: string };
  }> = appsRes.results ?? [];

  // Prefer Active, then Lead, then anything
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
