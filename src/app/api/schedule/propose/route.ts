import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { interviewStageConfigs, stageInterviewerPool, interviewers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getFreeBusy } from '@/lib/google/calendar';
import { getCandidateAvailability } from '@/lib/ashby/client';
import { proposeSchedules } from '@/lib/scheduling/algorithm';
import { addDays } from 'date-fns';
import { z } from 'zod';

const schema = z.object({
  candidateId: z.string(),
  applicationId: z.string().optional(),
  ashbyStageId: z.string(),
  candidateAvailability: z.array(z.object({
    start: z.string(),
    end: z.string(),
  })).optional(),
  lookAheadDays: z.number().default(14),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.parse(body);

    // Load stage config
    const config = await db.query.interviewStageConfigs.findFirst({
      where: eq(interviewStageConfigs.ashbyStageId, parsed.ashbyStageId),
    });

    if (!config) {
      return NextResponse.json(
        { error: 'Stage not configured. Please set it up in Admin → Stages.' },
        { status: 404 }
      );
    }

    // Load interviewer pool
    const poolRows = await db
      .select({ interviewer: interviewers })
      .from(stageInterviewerPool)
      .innerJoin(interviewers, eq(stageInterviewerPool.interviewerId, interviewers.id))
      .where(eq(stageInterviewerPool.stageConfigId, config.id));

    if (poolRows.length < config.interviewerCount) {
      return NextResponse.json(
        { error: `Not enough interviewers in pool. Need ${config.interviewerCount}, have ${poolRows.length}.` },
        { status: 400 }
      );
    }

    const pool = poolRows.map((r) => r.interviewer);
    const emails = pool.map((iv) => iv.email);

    // Determine time range to check
    const timeMin = new Date();
    const timeMax = addDays(timeMin, parsed.lookAheadDays);

    // Get free/busy for all pool members
    const busyMap = await getFreeBusy({ emails, timeMin, timeMax });

    // Get candidate availability
    let candidateWindows: Array<{ start: Date; end: Date }> = [];

    if (parsed.candidateAvailability?.length) {
      candidateWindows = parsed.candidateAvailability.map((w) => ({
        start: new Date(w.start),
        end: new Date(w.end),
      }));
    } else if (parsed.applicationId) {
      candidateWindows = await getCandidateAvailability(parsed.applicationId);
    }

    // Fallback: use full lookAhead window if no candidate availability
    if (!candidateWindows.length) {
      candidateWindows = [{ start: timeMin, end: timeMax }];
    }

    // Build interviewers with busy slots
    const interviewersWithAvailability = pool.map((iv) => ({
      ...iv,
      busySlots: busyMap[iv.email] ?? [],
    }));

    // Run scheduling algorithm
    const proposals = proposeSchedules({
      candidateWindows,
      interviewers: interviewersWithAvailability,
      config: {
        id: config.id,
        ashbyStageId: config.ashbyStageId,
        stageName: config.stageName,
        durationMinutes: config.durationMinutes,
        breakMinutes: config.breakMinutes,
        interviewerCount: config.interviewerCount,
        format: config.format as 'sequential' | 'parallel',
        pool: pool.map((iv) => ({ ...iv, ashbyUserId: iv.ashbyUserId ?? null })),
      },
    });

    // Attach candidateId
    const enrichedProposals = proposals.map((p) => ({
      ...p,
      candidateId: parsed.candidateId,
    }));

    return NextResponse.json({ proposals: enrichedProposals });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to generate schedule proposals' }, { status: 500 });
  }
}
