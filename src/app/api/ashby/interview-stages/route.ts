import { NextRequest, NextResponse } from 'next/server';
import { getInterviewStages } from '@/lib/ashby/client';
import { db } from '@/lib/db';
import { interviewStageConfigs, stageInterviewerPool, interviewers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

    const stages = await getInterviewStages(jobId);

    // Enrich with local config data
    const enriched = await Promise.all(
      stages.map(async (stage) => {
        const config = await db.query.interviewStageConfigs.findFirst({
          where: eq(interviewStageConfigs.ashbyStageId, stage.id),
        });

        let pool: typeof interviewers.$inferSelect[] = [];
        if (config) {
          const poolRows = await db.query.stageInterviewerPool.findMany({
            where: eq(stageInterviewerPool.stageConfigId, config.id),
            with: { interviewerId: true },
          });
          pool = poolRows.map((r: { interviewerId: typeof interviewers.$inferSelect }) => r.interviewerId);
        }

        return {
          ...stage,
          config: config ?? null,
          pool,
        };
      })
    );

    return NextResponse.json({ stages: enriched });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch stages' }, { status: 500 });
  }
}
