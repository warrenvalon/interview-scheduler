import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { interviewers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  ashbyUserId: z.string().optional(),
});

export async function GET() {
  try {
    const all = await db.select().from(interviewers).orderBy(interviewers.name);
    return NextResponse.json({ interviewers: all });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch interviewers' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const [created] = await db
      .insert(interviewers)
      .values({ ...data, isActive: true })
      .returning();

    return NextResponse.json({ interviewer: created }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create interviewer' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    await db.delete(interviewers).where(eq(interviewers.id, id));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to delete interviewer' }, { status: 500 });
  }
}
