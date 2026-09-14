CREATE TABLE IF NOT EXISTS public."ChallengeSeason" (
  "seasonKey" text PRIMARY KEY,
  "challengeName" text NOT NULL,
  "startDate" timestamp without time zone NOT NULL,
  "endDate" timestamp without time zone NOT NULL,
  "weeklyGoal" double precision NOT NULL DEFAULT 25,
  "scoringRules" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" text NOT NULL DEFAULT 'PLANNED' CHECK ("status" IN ('PLANNED','ACTIVE','ARCHIVED')),
  "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" timestamp without time zone,
  "completedAt" timestamp without time zone,
  CONSTRAINT "ChallengeSeason_dates_check" CHECK ("endDate" > "startDate")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChallengeSeason_one_active"
  ON public."ChallengeSeason" ((1)) WHERE "status"='ACTIVE';
CREATE INDEX IF NOT EXISTS "ChallengeSeason_dates_idx"
  ON public."ChallengeSeason" ("startDate","endDate");

INSERT INTO public."ChallengeSeason" (
  "seasonKey","challengeName","startDate","endDate","weeklyGoal","scoringRules","status","activatedAt"
)
SELECT to_char("startDate", 'YYYY-MM-DD'), "challengeName", "startDate", "endDate", "weeklyGoal", "scoringRules", 'ACTIVE', CURRENT_TIMESTAMP
FROM public."ChallengeSetting" WHERE id='primary'
ON CONFLICT ("seasonKey") DO UPDATE SET
  "challengeName"=EXCLUDED."challengeName",
  "startDate"=EXCLUDED."startDate",
  "endDate"=EXCLUDED."endDate",
  "weeklyGoal"=EXCLUDED."weeklyGoal",
  "scoringRules"=EXCLUDED."scoringRules",
  "status"='ACTIVE',
  "activatedAt"=COALESCE(public."ChallengeSeason"."activatedAt", EXCLUDED."activatedAt");

CREATE TABLE IF NOT EXISTS public."WeekFinalization" (
  "id" text PRIMARY KEY,
  "seasonKey" text NOT NULL REFERENCES public."ChallengeSeason"("seasonKey") ON DELETE CASCADE,
  "weekNumber" integer NOT NULL CHECK ("weekNumber" > 0),
  "weekStart" date NOT NULL,
  "weekEnd" date NOT NULL,
  "status" text NOT NULL DEFAULT 'FINALIZED' CHECK ("status" IN ('FINALIZED','OPEN')),
  "resultKey" text,
  "finalizedAt" timestamp without time zone,
  "finalizedById" text,
  "finalizedByName" text,
  "reopenedAt" timestamp without time zone,
  "reopenedById" text,
  "reopenedByName" text,
  "reopenReason" text,
  "updatedAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("seasonKey","weekNumber"),
  CONSTRAINT "WeekFinalization_dates_check" CHECK ("weekEnd" >= "weekStart")
);

CREATE INDEX IF NOT EXISTS "WeekFinalization_status_idx"
  ON public."WeekFinalization" ("seasonKey","status","weekNumber");