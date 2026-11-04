const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const plural = (n: number, unit: string): string => `${String(n)} ${unit}${n === 1 ? '' : 's'}`;

/** "5 minutes", "1 hour", "24 hours", "7 days". Used for expiry choices. */
export function formatTtl(seconds: number): string {
  if (seconds % DAY === 0 && seconds >= 2 * DAY) return plural(seconds / DAY, 'day');
  if (seconds % HOUR === 0) return plural(seconds / HOUR, 'hour');
  if (seconds % MINUTE === 0) return plural(seconds / MINUTE, 'minute');
  return plural(seconds, 'second');
}

/** Compact label for segmented controls: "5 min", "1 h", "24 h", "7 d". */
export function formatTtlShort(seconds: number): string {
  if (seconds % DAY === 0 && seconds >= 2 * DAY) return `${String(seconds / DAY)} d`;
  if (seconds % HOUR === 0) return `${String(seconds / HOUR)} h`;
  if (seconds % MINUTE === 0) return `${String(seconds / MINUTE)} min`;
  return `${String(seconds)} s`;
}

/**
 * Approximate time left in the largest sensible unit: "4 minutes", "23 hours", "7 days". Rounds to
 * the nearest unit so a fresh 7-day note reads "7 days"; the exact time is shown next to it.
 */
export function formatRemaining(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < MINUTE) return 'less than a minute';
  const minutes = Math.round(seconds / MINUTE);
  if (minutes < 60) return plural(minutes, 'minute');
  const hours = Math.round(seconds / HOUR);
  if (hours < 48) return plural(hours, 'hour');
  return plural(Math.round(seconds / DAY), 'day');
}

/** Absolute local time for an expiry, e.g. "Tue, 3 Nov, 16:40". */
export function formatExpiry(timestamp: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
