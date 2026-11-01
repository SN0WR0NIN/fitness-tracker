'use strict';

// Missing/null data remains valid for steady runs and older v7 archives.
// Do not normalize corrupt archived segments away: restore must fail closed.
function validateRunSegments(row, check) {
  const segments = row.runSegments;
  if (segments === undefined || segments === null) return;
  const valid = Array.isArray(segments) && segments.length >= 2 && segments.length <= 20
    && segments.every(segment => segment && typeof segment === 'object'
      && ['WORK', 'RECOVERY'].includes(segment.kind)
      && typeof segment.distance === 'number' && Number.isFinite(segment.distance) && segment.distance > 0 && segment.distance <= 1000
      && typeof segment.pace === 'number' && Number.isFinite(segment.pace) && segment.pace > 0 && segment.pace <= 60)
    && segments.some(segment => segment.kind === 'WORK')
    && segments.some(segment => segment.kind === 'RECOVERY');
  check(valid, 'Invalid archived run segments.');
  if (!valid) return;
  check(row.category === 'RUN', 'Only runs can contain archived run segments.');
  const distance = segments.reduce((sum, segment) => sum + segment.distance, 0);
  const pace = segments.reduce((sum, segment) => sum + segment.distance * segment.pace, 0) / distance;
  check(Number.isFinite(distance) && Number.isFinite(pace), 'Archived run segment totals must be finite.');
  check(typeof row.distance === 'number' && Math.abs(row.distance - distance) < 1e-6,
    'Archived run distance differs from segment total.');
  check(typeof row.pace === 'number' && Math.abs(row.pace - pace) < 1e-6,
    'Archived run pace differs from segment average.');
}

module.exports = { validateRunSegments };
