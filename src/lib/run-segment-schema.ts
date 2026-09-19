import { z } from 'zod';

export const RunSegmentSchema = z.object({
  kind: z.enum(['WORK', 'RECOVERY']),
  distance: z.number().positive('Segment distance must be greater than zero').max(1000, 'Segment distance is too large'),
  pace: z.number().positive('Segment pace must be greater than zero').max(60, 'Segment pace is too large'),
}).strict();

export const RunSegmentsSchema = z.array(RunSegmentSchema)
  .min(2, 'Add at least one work segment and one recovery segment.')
  .max(20, 'Add no more than 20 interval pace groups.')
  .superRefine((segments, context) => {
    if (!segments.some(segment => segment.kind === 'WORK')) {
      context.addIssue({ code: 'custom', message: 'Add at least one work segment.' });
    }
    if (!segments.some(segment => segment.kind === 'RECOVERY')) {
      context.addIssue({ code: 'custom', message: 'Add at least one recovery segment.' });
    }
  });
