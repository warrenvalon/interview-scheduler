import { AshbyCandidate, AshbyJob, AshbyInterviewStage } from '@/types';

const ASHBY_API_BASE = 'https://api.ashbyhq.com';
const API_KEY = process.env.ASHBY_API_KEY!;

async function ashbyPost<T>(endpoint: string, body: Record<string, unknown> = {}): Promise<T> {
  const credentials = Buffer.from(`${API_KEY}:`).toString('base64');
  const res = await fetch(`${ASHBY_API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ashby API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(`Ashby API error: ${data.errors?.join(', ') ?? 'Unknown error'}`);
  }
  // Return full response so callers can access results, nextCursor, etc.
  return data as T;
}

export async function listCandidates(params: {
  jobId?: string;
  cursor?: string;
  limit?: number;
}): Promise<{ candidates: AshbyCandidate[]; nextCursor?: string }> {
  const body: Record<string, unknown> = { limit: params.limit ?? 50 };
  if (params.jobId) body.jobId = params.jobId;
  if (params.cursor) body.cursor = params.cursor;

  const data = await ashbyPost<{
    results: Array<{
      id: string;
      name: string;
      emailAddresses?: Array<{ value: string; type?: string }>;
      applicationIds?: string[];
    }>;
    nextCursor?: string;
  }>('/candidate.list', body);

  const candidates: AshbyCandidate[] = (data.results ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    email: c.emailAddresses?.[0]?.value ?? '',
    applicationId: c.applicationIds?.[0],
  }));

  return { candidates, nextCursor: data.nextCursor };
}

export async function getCandidate(candidateId: string): Promise<AshbyCandidate> {
  const res = await ashbyPost<{
    results: {
      id: string;
      name: string;
      emailAddresses?: Array<{ value: string }>;
      applicationIds?: string[];
    };
  }>('/candidate.info', { id: candidateId });

  const c = res.results;
  const applicationId = c.applicationIds?.[0];

  // Fetch application details to get job + stage info
  let jobTitle: string | undefined;
  let jobId: string | undefined;
  let currentStage: string | undefined;
  let currentStageId: string | undefined;

  if (applicationId) {
    try {
      const appRes = await ashbyPost<{
        results: {
          id: string;
          job?: { id: string; title: string };
          currentInterviewStage?: { id: string; title: string };
        };
      }>('/application.info', { id: applicationId });
      jobTitle = appRes.results?.job?.title;
      jobId = appRes.results?.job?.id;
      currentStage = appRes.results?.currentInterviewStage?.title;
      currentStageId = appRes.results?.currentInterviewStage?.id;
    } catch {
      // non-fatal
    }
  }

  return {
    id: c.id,
    name: c.name,
    email: c.emailAddresses?.[0]?.value ?? '',
    jobTitle,
    jobId,
    currentStage,
    currentStageId,
    applicationId,
  };
}

export async function listJobs(): Promise<AshbyJob[]> {
  const data = await ashbyPost<{
    results: Array<{ id: string; title: string; status: string }>;
  }>('/job.list', {});

  return (data.results ?? []).map((j) => ({
    id: j.id,
    title: j.title,
    status: j.status,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractStages(data: any): AshbyInterviewStage[] {
  const stages: AshbyInterviewStage[] = [];

  // Structure A: results.interviewPlan.phaseGroups[].interviewStages[]
  for (const group of data.results?.interviewPlan?.phaseGroups ?? []) {
    for (const stage of group.interviewStages ?? []) {
      stages.push({ id: stage.id, title: stage.title, type: stage.type ?? '', orderIndex: stage.orderIndex ?? 0 });
    }
  }
  if (stages.length > 0) return stages;

  // Structure B: results.phaseGroups[].interviewStages[]
  for (const group of data.results?.phaseGroups ?? []) {
    for (const stage of group.interviewStages ?? []) {
      stages.push({ id: stage.id, title: stage.title, type: stage.type ?? '', orderIndex: stage.orderIndex ?? 0 });
    }
  }
  if (stages.length > 0) return stages;

  // Structure C: results.interviewStages[]
  for (const stage of data.results?.interviewStages ?? []) {
    stages.push({ id: stage.id, title: stage.title, type: stage.type ?? '', orderIndex: stage.orderIndex ?? 0 });
  }
  if (stages.length > 0) return stages;

  // Structure D: results is an array of stages
  if (Array.isArray(data.results)) {
    for (const stage of data.results) {
      if (stage.id && stage.title) {
        stages.push({ id: stage.id, title: stage.title, type: stage.type ?? '', orderIndex: stage.orderIndex ?? 0 });
      }
    }
  }

  return stages;
}

export async function getInterviewStages(jobId: string): Promise<AshbyInterviewStage[]> {
  // Step 1: fetch the job to get its interview plan ID
  // jobInterviewPlan.info requires the plan ID, not the job ID
  let planId: string | undefined;
  try {
    const jobData = await ashbyPost<{
      results?: { defaultInterviewPlanId?: string; interviewPlanIds?: string[] };
    }>('/job.info', { id: jobId });
    planId = jobData.results?.defaultInterviewPlanId ?? jobData.results?.interviewPlanIds?.[0];
  } catch {
    // non-fatal; fall through to direct attempts
  }

  // Step 2: fetch the interview plan by plan ID
  if (planId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await ashbyPost<any>('/jobInterviewPlan.info', { id: planId });
      const stages = extractStages(data);
      if (stages.length > 0) return stages.sort((a, b) => a.orderIndex - b.orderIndex);
    } catch {
      // fall through
    }
  }

  return [];
}

export async function getCandidateAvailability(
  applicationId: string
): Promise<Array<{ start: Date; end: Date }>> {
  try {
    const data = await ashbyPost<{
      results?: Array<{
        availabilityWindows?: Array<{ startTime: string; endTime: string }>;
      }>;
    }>('/interviewSchedule.list', { applicationId });

    const windows: Array<{ start: Date; end: Date }> = [];
    for (const schedule of data.results ?? []) {
      for (const w of schedule.availabilityWindows ?? []) {
        windows.push({ start: new Date(w.startTime), end: new Date(w.endTime) });
      }
    }
    return windows;
  } catch {
    return [];
  }
}
