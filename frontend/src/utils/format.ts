const DAY_MS = 86_400_000;

/** "Tue 9:15:12 AM" within the coming/past week, otherwise "Nov 3, 9:15 AM" (the list pill style). */
export function formatPillTime(iso: string) {
  const d = new Date(iso);
  if (Math.abs(d.getTime() - Date.now()) < 6 * DAY_MS) {
    const day = d.toLocaleDateString(undefined, { weekday: 'short' });
    const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    return `${day} ${time}`;
  }
  return formatShortDateTime(iso);
}

/** "Nov 3, 10:23 AM" (email detail header). */
export const formatShortDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** "Oct 3, 2026, 10:00 AM" */
export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** "Tomorrow, 10:00 AM" style labels for the Send Later presets. */
export const formatTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const initials = (name: string) =>
  name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

export const pluralize = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
