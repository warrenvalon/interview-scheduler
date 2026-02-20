import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { interviewStageConfigs, stageInterviewerPool } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const upsertSchema = z.object({
  ashbyStageId: z.string(),
  stageName: z.string(),
  jobId: z.string().optional(),
  durationMinutes: z.number().default(60),
  breakMinutes: z.number().default(15),
  interviewerCount: z.number().default(1),
  format: z.enum(['sequential', 'parallel']).default('sequential'),
  interviewerIds: z.array(z.string()),
});

export async function GET() {
  try {
    const configs = await db.select().from(interviewStageConfigs);
    return NextResponse.json({ configs });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch configs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { interviewerIds, ...configData } = upsertSchema.parse(body);

    // Upsert stage config
    const [config] = await db
      .insert(interviewStageConfigs)
      .values(configData)
      .onConflictDoUpdate({
        target: interviewStageConfigs.ashbyStageId,
        set: {
          stageName: configData.stageName,
          durationMinutes: configData.durationMinutes,
          breakMinutes: configData.breakMinutes,
          interviewerCount: configData.interviewerCount,
          format: configData.format,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Replace pool
    await db
      .delete(stageInterviewerPool)
      .where(eq(stageInterviewerPool.stageConfigId, config.id));

    if (interviewerIds.length > 0) {
      await db.insert(stageInterviewerPool).values(
        interviewerIds.map((id, i) => ({
          stageConfigId: config.id,
          interviewerId: id,
          priority: i,
        }))
      );
    }

    return NextResponse.json({ config }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to save stage config' }, { status: 500 });
  }
}
