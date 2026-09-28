export const HOUR_MS = 60 * 60 * 1000;

/** Index of the clock-hour window a timestamp falls in (UTC hours since epoch). */
export const hourWindow = (ts: number) => Math.floor(ts / HOUR_MS);
export const windowStart = (window: number) => window * HOUR_MS;

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
