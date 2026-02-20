import { addMinutes, isWithinInterval, areIntervalsOverlapping } from 'date-fns';
import { TimeWindow, Interviewer, ScheduleBlock, ScheduleProposal, StageConfig } from '@/types';

interface AlgorithmInput {
  candidateWindows: TimeWindow[];
  interviewers: Array<Interviewer & { busySlots: TimeWindow[] }>;
  config: StageConfig;
}

function isInterviewerFree(
  interviewer: { busySlots: TimeWindow[] },
  slot: TimeWindow
): boolean {
  return !interviewer.busySlots.some((busy) =>
    areIntervalsOverlapping(
      { start: busy.start, end: busy.end },
      { start: slot.start, end: slot.end },
      { inclusive: false }
    )
  );
}

function scoreProposal(blocks: ScheduleBlock[]): number {
  let score = 100;
  const interviewBlocks = blocks.filter((b) => b.type === 'interview');
  if (!interviewBlocks.length) return 0;

  const startHour = interviewBlocks[0].startTime.getUTCHours();
  const dayOfWeek = interviewBlocks[0].startTime.getUTCDay();

  // Prefer business hours 9am-5pm
  if (startHour >= 9 && startHour <= 12) score += 20;
  else if (startHour > 12 && startHour <= 16) score += 10;
  else score -= 30;

  // Penalize weekends
  if (dayOfWeek === 0 || dayOfWeek === 6) score -= 50;

  // Prefer earlier dates
  const daysFromNow = Math.floor(
    (interviewBlocks[0].startTime.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  score -= daysFromNow * 0.5;

  return score;
}

export function proposeSchedules(input: AlgorithmInput): ScheduleProposal[] {
  const { candidateWindows, interviewers, config } = input;
  const { durationMinutes, breakMinutes, interviewerCount } = config;

  const proposals: ScheduleProposal[] = [];
  const seenKeys = new Set<string>();

  for (const window of candidateWindows) {
    let t = new Date(window.start);
    const windowEnd = new Date(window.end);

    // Align to next 30-min boundary
    const remainder = t.getMinutes() % 30;
    if (remainder !== 0) {
      t = addMinutes(t, 30 - remainder);
    }

    while (true) {
      // Calculate total duration for this panel
      const totalDuration =
        durationMinutes * interviewerCount + breakMinutes * (interviewerCount - 1);
      const proposalEnd = addMinutes(t, totalDuration);

      if (proposalEnd > windowEnd) break;

      // Find available interviewers for each slot
      const slotAssignments: Array<{
        available: typeof interviewers;
        start: Date;
        end: Date;
      }> = [];

      let valid = true;
      for (let i = 0; i < interviewerCount; i++) {
        const slotStart = addMinutes(
          t,
          i * (durationMinutes + breakMinutes)
        );
        const slotEnd = addMinutes(slotStart, durationMinutes);

        const available = interviewers.filter((iv) =>
          isInterviewerFree(iv, { start: slotStart, end: slotEnd })
        );

        if (available.length === 0) {
          valid = false;
          break;
        }
        slotAssignments.push({ available, start: slotStart, end: slotEnd });
      }

      if (valid) {
        // Build blocks with best available interviewer per slot
        const blocks: ScheduleBlock[] = [];
        const alternateInterviewers: Record<number, Interviewer[]> = {};
        const assignedIds = new Set<string>();

        for (let i = 0; i < slotAssignments.length; i++) {
          const { available, start, end } = slotAssignments[i];
          // Pick first not already assigned
          const pick = available.find((iv) => !assignedIds.has(iv.id)) ?? available[0];
          assignedIds.add(pick.id);

          blocks.push({
            type: 'interview',
            interviewerId: pick.id,
            interviewerName: pick.name,
            interviewerEmail: pick.email,
            startTime: start,
            endTime: end,
            durationMinutes,
          });

          // Alternates: others who are free at this slot (excluding primary pick)
          alternateInterviewers[i] = available
            .filter((iv) => iv.id !== pick.id)
            .map(({ busySlots: _busy, ...iv }) => iv);

          // Add break after each interview except the last
          if (i < slotAssignments.length - 1) {
            blocks.push({
              type: 'break',
              startTime: end,
              endTime: addMinutes(end, breakMinutes),
              durationMinutes: breakMinutes,
            });
          }
        }

        const key = `${t.toISOString()}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const proposal: ScheduleProposal = {
            id: `${Date.now()}-${proposals.length}`,
            candidateId: '',
            stageId: config.ashbyStageId,
            stageName: config.stageName,
            blocks,
            score: scoreProposal(blocks),
            startTime: t,
            endTime: proposalEnd,
            alternateInterviewers,
          };
          proposals.push(proposal);
        }
      }

      t = addMinutes(t, 30);
    }
  }

  proposals.sort((a, b) => b.score - a.score);
  return proposals.slice(0, 3);
}
