export interface TimeWindow {
  start: Date;
  end: Date;
}

export interface Interviewer {
  id: string;
  email: string;
  name: string;
  ashbyUserId?: string | null;
  isActive: boolean;
}

export interface InterviewerWithAvailability extends Interviewer {
  busySlots: TimeWindow[];
}

export interface ScheduleBlock {
  type: 'interview' | 'break';
  interviewerId?: string;
  interviewerName?: string;
  interviewerEmail?: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
}

export interface ScheduleProposal {
  id: string;
  candidateId: string;
  stageId: string;
  stageName: string;
  blocks: ScheduleBlock[];
  score: number;
  startTime: Date;
  endTime: Date;
  alternateInterviewers: Record<number, Interviewer[]>; // slot index → alternatives
}

export interface StageConfig {
  id: string;
  ashbyStageId: string;
  stageName: string;
  durationMinutes: number;
  breakMinutes: number;
  interviewerCount: number;
  format: 'sequential' | 'parallel';
  pool: Interviewer[];
}

export interface AshbyCandidate {
  id: string;
  name: string;
  email: string;
  jobTitle?: string;
  jobId?: string;
  currentStage?: string;
  currentStageId?: string;
  applicationId?: string;
}

export interface AshbyJob {
  id: string;
  title: string;
  status: string;
}

export interface AshbyInterviewStage {
  id: string;
  title: string;
  type: string;
  orderIndex: number;
}
