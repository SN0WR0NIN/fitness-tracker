/**
 * Display formatting helpers for activity metrics.
 * Raw values from Strava (e.g. 5.0057km, 5.184090137243542 min/km) are precise
 * GPS-derived numbers; Strava's own UI rounds these for display, so we match
 * that presentation here rather than showing raw floating point noise.
 */

/** Rounds distance to 2 decimal places, matching how Strava displays it. */
export function formatDistance(distance: number): string {
  return distance.toFixed(2);
}

/** Converts decimal minutes-per-km (e.g. 5.1841) into "M:SS" pace notation (e.g. "5:11"). */
export function formatPace(paceMinPerKm: number): string {
  const minutes = Math.floor(paceMinPerKm);
  const seconds = Math.round((paceMinPerKm - minutes) * 60);
  // Handle rounding up to a full minute (e.g. 5:60 -> 6:00)
  const adjustedMinutes = seconds === 60 ? minutes + 1 : minutes;
  const adjustedSeconds = seconds === 60 ? 0 : seconds;
  return `${adjustedMinutes}:${adjustedSeconds.toString().padStart(2, '0')}`;
}
