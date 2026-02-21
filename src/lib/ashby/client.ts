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
  // Use application.list with status:'Active' so we only get active pipeline candidates
  // (avoids paginating through thousands of historical Archived/Hired records)
  const body: Record<string, unknown> = {
    limit: params.limit ?? 100,
    status: 'Active',
  };
  if (params.jobId) body.jobId = params.jobId;
  if (params.cursor) body.cursor = params.cursor;

  const data = await ashbyPost<{
    results: Array<{
      id: string;
      status: string;
      candidate: {
        id: string;
        name: string;
        // application.list returns primaryEmailAddress, not emailAddresses array
        primaryEmailAddress?: { value: string };
      };
      job?: { id: string; title: string };
      currentInterviewStage?: { id: string; title: string };
    }>;
    nextCursor?: string;
  }>('/application.list', body);

  const candidates: AshbyCandidate[] = (data.results ?? []).map((app) => ({
    id: app.candidate.id,
    name: app.candidate.name,
    email: app.candidate.primaryEmailAddress?.value ?? '',
    applicationId: app.id,
    jobTitle: app.job?.title,
    jobId: app.job?.id,
    currentStage: app.currentInterviewStage?.title,
    currentStageId: app.currentInterviewStage?.id,
  }));

  return { candidates, nextCursor: data.nextCursor };
}

export async function getCandidate(candidateId: string): Promise<AshbyCandidate> {
  // Use application.list filtered to this candidate to get active application + job/stage
  const appsRes = await ashbyPost<{
    results: Array<{
      id: string;
      status: string;
      candidate: {
        id: string;
        name: string;
        primaryEmailAddress?: { value: string };
      };
      job?: { id: string; title: string };
      currentInterviewStage?: { id: string; title: string };
    }>;
  }>('/application.list', { candidateId, limit: 50 });

  // Prefer active application; fall back to most recent if none active
  const apps = appsRes.results ?? [];
  const activeApp = apps.find((a) => a.status === 'Active') ?? apps[0];

  if (!activeApp) {
    // Last resort: candidate.info for name/email only
    const res = await ashbyPost<{
      results: { id: string; name: string; primaryEmailAddress?: { value: string }; emailAddresses?: Array<{ value: string }> };
    }>('/candidate.info', { id: candidateId });
    const c = res.results;
    return {
      id: c.id,
      name: c.name,
      email: c.primaryEmailAddress?.value ?? c.emailAddresses?.[0]?.value ?? '',
    };
  }

  return {
    id: activeApp.candidate.id,
    name: activeApp.candidate.name,
    email: activeApp.candidate.primaryEmailAddress?.value ?? '',
    applicationId: activeApp.id,
    jobTitle: activeApp.job?.title,
    jobId: activeApp.job?.id,
    currentStage: activeApp.currentInterviewStage?.title,
    currentStageId: activeApp.currentInterviewStage?.id,
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
  // Step 1: fetch the job to get its defaultInterviewPlanId
  const jobData = await ashbyPost<{
    results?: { defaultInterviewPlanId?: string; interviewPlanIds?: string[] };
  }>('/job.info', { id: jobId });

  const planId = jobData.results?.defaultInterviewPlanId ?? jobData.results?.interviewPlanIds?.[0];
  if (!planId) return [];

  // Step 2: use interviewStage.list with the plan ID (correct Ashby endpoint)
  const data = await ashbyPost<{
    results?: Array<{
      id: string;
      title: string;
      type: string;
      orderInInterviewPlan: number;
    }>;
  }>('/interviewStage.list', { interviewPlanId: planId });

  return (data.results ?? []).map((s, i) => ({
    id: s.id,
    title: s.title,
    type: s.type ?? '',
    orderIndex: s.orderInInterviewPlan ?? i,
  }));
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
