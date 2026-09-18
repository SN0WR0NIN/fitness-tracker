/**
 * Pace input helpers.
 *
 * The UI stores pace text as min:sec (for example 5:45).
 * Users can type digits only: 545 -> 5:45, 1030 -> 10:30.
 */

export function paceNumberToInput(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return '';
  let minutes = Math.floor(value);
  let seconds = Math.round((value - minutes) * 60);
  if (seconds >= 60) {
    minutes += 1;
    seconds = 0;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function maskPaceInput(raw: string): string {
  const value = raw.trim();
  if (!value) return '';

  // Convert pasted/legacy decimal pace into the canonical min:sec format.
  if (!value.includes(':') && value.includes('.')) {
    const decimal = Number(value);
    if (Number.isFinite(decimal) && decimal > 0) return paceNumberToInput(decimal);
  }

  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (!digits) return '';

  // Keep the colon visible from the first digit onwards.
  if (digits.length === 1) return `${digits}:`;
  if (digits.length <= 3) return `${digits[0]}:${digits.slice(1)}`;

  // Four digits allow a two-digit minute value, e.g. 1030 -> 10:30.
  return `${digits.slice(0, -2)}:${digits.slice(-2)}`;
}

export function normalizePaceInput(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') return paceNumberToInput(value);

  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.includes(':')) {
    const [minutesText, secondsText = ''] = trimmed.split(':', 2);
    const minutes = Number(minutesText);
    const seconds = Number(secondsText);
    if (
      Number.isFinite(minutes) &&
      Number.isFinite(seconds) &&
      minutes >= 0 &&
      seconds >= 0 &&
      seconds < 60 &&
      secondsText.length === 2
    ) {
      return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }
    return maskPaceInput(trimmed);
  }

  const decimal = Number(trimmed);
  return Number.isFinite(decimal) && decimal > 0 ? paceNumberToInput(decimal) : maskPaceInput(trimmed);
}

export function parsePaceInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const minutes = Number(match[1]);
    const seconds = Number(match[2]);
    if (minutes >= 0 && seconds >= 0 && seconds < 60) return minutes + seconds / 60;
    return undefined;
  }

  // Backward-compatible fallback for old saved drafts.
  const decimal = Number(trimmed);
  return Number.isFinite(decimal) && decimal > 0 ? decimal : undefined;
}
