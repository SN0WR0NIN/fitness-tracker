import { normalizeRunSegments, summarizeRunSegments } from './scoring';
import { RunSegmentsSchema } from './run-segment-schema';

type Metrics = { category: string; distance: number; pace: number | null; runSegments?: unknown };

/** Omission keeps interval data; only an explicit null converts a run to steady. */
export function correctionRunMetrics(original: Metrics, proposed: Metrics) {
  if (proposed.runSegments != null && proposed.category !== 'RUN') {
    throw new Error('Interval segments are available only for Run activities.');
  }
  let runSegments = proposed.runSegments == null ? [] : RunSegmentsSchema.parse(proposed.runSegments);
  if (proposed.category === 'RUN' && proposed.runSegments === undefined) {
    runSegments = normalizeRunSegments(original.runSegments);
    if (runSegments.length && (proposed.distance !== original.distance || proposed.pace !== original.pace)) {
      throw new Error('Edit the interval segments or explicitly switch to a steady run before changing distance or pace.');
    }
  }
  if (runSegments.length) {
    const summary = summarizeRunSegments(runSegments);
    return { runSegments, distance: summary.distance, pace: summary.pace ?? null };
  }
  return { runSegments, distance: proposed.distance, pace: proposed.pace };
}
