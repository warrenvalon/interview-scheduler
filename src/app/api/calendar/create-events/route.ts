import { NextRequest, NextResponse } from 'next/server';
import { createCalendarEvent } from '@/lib/google/calendar';
import { db } from '@/lib/db';
import { scheduledInterviews } from '@/lib/db/schema';
import { ScheduleProposal } from '@/types';
import { z } from 'zod';

const schema = z.object({
  proposal: z.object({
    id: z.string(),
    candidateId: z.string(),
    stageId: z.string(),
    stageName: z.string(),
    blocks: z.array(z.any()),
  }),
  candidateName: z.string(),
  candidateEmail: z.string(),
  createdBy: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { proposal, candidateName, candidateEmail, createdBy } = schema.parse(body);
    const calendarEventIds: Record<string, string> = {};

    for (const block of proposal.blocks) {
      if (block.type !== 'interview') continue;

      const eventId = await createCalendarEvent({
        organizerEmail: block.interviewerEmail,
        title: `Interview: ${candidateName} — ${proposal.stageName}`,
        description: `Interview scheduled via Interview Scheduler`,
        startTime: new Date(block.startTime),
        endTime: new Date(block.endTime),
        attendeeEmails: [block.interviewerEmail, candidateEmail],
      });

      calendarEventIds[block.interviewerId] = eventId;
    }

    await db.insert(scheduledInterviews).values({
      candidateId: proposal.candidateId,
      candidateName,
      candidateEmail,
      ashbyStageId: proposal.stageId,
      stageName: proposal.stageName,
      status: 'confirmed',
      scheduledBlocks: proposal.blocks,
      calendarEventIds,
      createdBy,
      confirmedAt: new Date(),
    });

    return NextResponse.json({ success: true, calendarEventIds });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create events' }, { status: 500 });
  }
}
