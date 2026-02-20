import { NextRequest, NextResponse } from 'next/server';
import { getFreeBusy } from '@/lib/google/calendar';
import { z } from 'zod';

const schema = z.object({
  emails: z.array(z.string().email()),
  timeMin: z.string().datetime(),
  timeMax: z.string().datetime(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { emails, timeMin, timeMax } = schema.parse(body);

    const busyMap = await getFreeBusy({
      emails,
      timeMin: new Date(timeMin),
      timeMax: new Date(timeMax),
    });

    return NextResponse.json({ busyMap });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch free/busy' }, { status: 500 });
  }
}
