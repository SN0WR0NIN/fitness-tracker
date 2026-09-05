import { createHash } from 'node:crypto';
import { z } from 'zod';
import { calculateActivityPoints, resolveEffectiveCategory, getWeekStart, getWeekNumber, type ScoringRules } from './scoring';

export const ImportRowSchema = z.object({
  name: z.string().trim().min(1).max(120),
  column: z.string().trim().min(1).max(120),
  occurredAt: z.string().datetime({ offset: true }),
  category: z.enum(['RUN', 'CYCLE', 'SWIM', 'WALK_OR_HIKE', 'TROOP_GAMES']),
  distance: z.number().finite().min(0).max(100000),
  pace: z.number().finite().positive().max(60).optional(),
  companion: z.string().trim().max(500).optional(),
  proofUrl: z.string().url().refine((url) => url.startsWith('https://'), 'Proof must use HTTPS').optional(),
}).refine((row) => row.category === 'TROOP_GAMES' || row.distance > 0, 'Distance must be positive');
export const ImportSchema = z.object({
  rows: z.array(ImportRowSchema).min(1).max(500),
  mappings: z.record(z.string(), z.object({ userId: z.string().min(1), columnId: z.string().min(1) })),
  skip: z.array(z.string()).max(500).default([]),
  commit: z.boolean().default(false),
  previewHash: z.string().optional(),
});
export type ImportRow = z.infer<typeof ImportRowSchema>;
export const normalizeName = (value: string) => value.trim().toLocaleLowerCase('en').replace(/\s+/g, ' ');
export const participantKey = (row: Pick<ImportRow, 'name' | 'column'>) => `${normalizeName(row.name)}|${normalizeName(row.column)}`;
export const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const placeholderId = (key: string) => `historical_${hash(key).slice(0, 32)}`;
export function prepareRow(row: ImportRow, rules: ScoringRules, startDate: Date) {
  const category = resolveEffectiveCategory(row.category, row.pace, rules);
  const points = calculateActivityPoints({ category, distance: row.distance, pace: row.pace, completedWithFriend: Boolean(row.companion) }, rules).totalPoints;
  const occurredAt = new Date(row.occurredAt);
  // Stable across file ordering and repeated uploads. Never use a row number as identity.
  const id = `historical_${hash([participantKey(row), occurredAt.toISOString(), row.category, row.distance, row.pace ?? null, row.proofUrl ?? null]).slice(0, 40)}`;
  return { id, category, points, occurredAt, weekStart: getWeekStart(occurredAt), weekNumber: getWeekNumber(occurredAt, startDate) };
}
export const categoryField = { RUN: 'runPoints', CYCLE: 'cyclePoints', SWIM: 'swimPoints', WALK_OR_HIKE: 'hikePoints', TROOP_GAMES: 'troopGamePoints' } as const;
