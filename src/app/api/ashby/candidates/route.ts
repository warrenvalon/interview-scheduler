import { NextRequest, NextResponse } from 'next/server';

function ashbyPost(endpoint: string, body: object) {
  const credentials = Buffer.from(`${process.env.ASHBY_API_KEY!}:`).toString('base64');
  return fetch(`https://api.ashbyhq.com${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json());
}

export async function GET(_req: NextRequest) {
  try {
    // candidate.list returns one record per PERSON — no duplicates, no status issues
    const all: Array<{
      id: string;
      name: string;
      emailAddresses?: Array<{ value: string }>;
      applicationIds?: string[];
    }> = [];

    let cursor: string | undefined;
    do {
      const body: Record<string, unknown> = { limit: 100 };
      if (cursor) body.cursor = cursor;
      const data = await ashbyPost('/candidate.list', body);
      if (!data.success) break;
      all.push(...(data.results ?? []));
      cursor = data.nextCursor;
    } while (cursor && all.length < 10000);

    // Map to the shape the frontend expects — no filtering here, show everyone
    const candidates = all.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.emailAddresses?.[0]?.value ?? '',
      applicationId: c.applicationIds?.[c.applicationIds.length - 1], // most recent
    }));

    return NextResponse.json({ candidates, total: candidates.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch candidates' }, { status: 500 });
  }
}
