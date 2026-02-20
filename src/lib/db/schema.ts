import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uuid,
} from 'drizzle-orm/pg-core';

export const interviewers = pgTable('interviewers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  ashbyUserId: text('ashby_user_id'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const interviewStageConfigs = pgTable('interview_stage_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  ashbyStageId: text('ashby_stage_id').notNull().unique(),
  stageName: text('stage_name').notNull(),
  jobId: text('job_id'),
  durationMinutes: integer('duration_minutes').notNull().default(60),
  breakMinutes: integer('break_minutes').notNull().default(15),
  interviewerCount: integer('interviewer_count').notNull().default(1),
  format: text('format').notNull().default('sequential'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const stageInterviewerPool = pgTable('stage_interviewer_pool', {
  id: uuid('id').primaryKey().defaultRandom(),
  stageConfigId: uuid('stage_config_id')
    .notNull()
    .references(() => interviewStageConfigs.id, { onDelete: 'cascade' }),
  interviewerId: uuid('interviewer_id')
    .notNull()
    .references(() => interviewers.id, { onDelete: 'cascade' }),
  priority: integer('priority').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const scheduledInterviews = pgTable('scheduled_interviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  candidateId: text('candidate_id').notNull(),
  candidateName: text('candidate_name').notNull(),
  candidateEmail: text('candidate_email').notNull(),
  ashbyStageId: text('ashby_stage_id').notNull(),
  stageName: text('stage_name').notNull(),
  status: text('status').notNull().default('proposed'),
  scheduledBlocks: jsonb('scheduled_blocks').notNull(),
  calendarEventIds: jsonb('calendar_event_ids'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  confirmedAt: timestamp('confirmed_at'),
});

export type Interviewer = typeof interviewers.$inferSelect;
export type NewInterviewer = typeof interviewers.$inferInsert;
export type InterviewStageConfig = typeof interviewStageConfigs.$inferSelect;
export type NewInterviewStageConfig = typeof interviewStageConfigs.$inferInsert;
export type ScheduledInterview = typeof scheduledInterviews.$inferSelect;
