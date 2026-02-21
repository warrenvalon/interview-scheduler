import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

function ashbyPost(endpoint: string, body: object) {
  const credentials = Buffer.from(`${process.env.ASHBY_API_KEY!}:`).toString('base64');
  return fetch(`https://api.ashbyhq.com${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json());
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const candidateId = searchParams.get('candidateId'); // paste from Ashby URL
  const searchName = searchParams.get('name') ?? 'James Underwood';

  // Scan the first 10 pages of candidate.list looking for the name
  let found = null;
  let cursor: string | undefined;
  let page = 0;
  let total = 0;

  while (page < 10) {
    const body: Record<string, unknown> = { limit: 100 };
    if (cursor) body.cursor = cursor;
    const data = await ashbyPost('/candidate.list', body);
    if (!data.success || !data.results?.length) break;

    total += data.results.length;
    const match = data.results.find((c: { name: string }) =>
      c.name.toLowerCase().includes(searchName.toLowerCase())
    );
    if (match) {
      found = match;
      break;
    }
    cursor = data.nextCursor;
    if (!cursor) break;
    page++;
  }

  // If candidateId provided, look up directly
  let directLookup = null;
  let directApps = null;
  if (candidateId) {
    directLookup = await ashbyPost('/candidate.info', { id: candidateId });
    directApps = await ashbyPost('/application.list', { candidateId, limit: 20 });
  }

  return NextResponse.json({
    searched_for: searchName,
    scanned_candidates: total,
    pages_scanned: page + 1,
    found_in_candidate_list: found ? {
      id: found.id,
      name: found.name,
      email: found.emailAddresses?.[0]?.value,
      applicationIds: found.applicationIds,
      applicationIds_count: found.applicationIds?.length ?? 0,
    } : null,
    // Direct lookup results if candidateId provided
    direct_candidate: directLookup?.results ? {
      id: directLookup.results.id,
      name: directLookup.results.name,
      applicationIds: directLookup.results.applicationIds,
    } : null,
    direct_applications: directApps?.results?.map((a: Record<string, unknown>) => ({
      id: a.id,
      status: a.status,
      stage: (a.currentInterviewStage as Record<string, unknown>)?.title,
      job: (a.job as Record<string, unknown>)?.title,
    })),
    hint: 'Add ?candidateId=UUID from Ashby URL for direct lookup. Add ?name=Someone+Else to search for different person.',
  });
}
