import { env } from '../config/env';
import { redis } from '../lib/clients';

/**
 * Finds the earliest clock-hour window (starting at ARGV[3]) where BOTH the
 * per-sender counter and the per-campaign counter are below their limits, and
 * atomically reserves one slot in it. Running as a single Lua script makes the
 * check-and-increment atomic across any number of workers or instances.
 *
 * Returns { window, reason } where reason says which limit was full in the
 * first window we looked at (0 = none, 1 = sender, 2 = campaign).
 *
 * Note: keys are built inside the script, which is fine for a single Redis
 * node but not Redis Cluster (keys would need a shared hash tag).
 */
const RESERVE_WINDOW_LUA = `
local senderPrefix = ARGV[1]
local campaignPrefix = ARGV[2]
local fromWindow = tonumber(ARGV[3])
local senderLimit = tonumber(ARGV[4])
local campaignLimit = tonumber(ARGV[5])
local lookahead = tonumber(ARGV[6])
local reason = 0
for i = 0, lookahead do
  local w = fromWindow + i
  local sk = senderPrefix .. w
  local ck = campaignPrefix .. w
  local sc = tonumber(redis.call('GET', sk) or '0')
  local cc = tonumber(redis.call('GET', ck) or '0')
  if sc < senderLimit and cc < campaignLimit then
    local ttl = (i + 2) * 3600
    redis.call('INCR', sk)
    redis.call('EXPIRE', sk, ttl)
    redis.call('INCR', ck)
    redis.call('EXPIRE', ck, ttl)
    return {w, reason, sc + 1, cc + 1}
  end
  if i == 0 then
    if sc >= senderLimit then reason = 1 else reason = 2 end
  end
end
return {-1, reason, 0, 0}
`;

/**
 * Per-sender send slot: returns the earliest timestamp >= now that is at least
 * `gap` ms after the previous reserved slot, and reserves it.
 */
const RESERVE_SLOT_LUA = `
local now = tonumber(ARGV[1])
local gap = tonumber(ARGV[2])
local nextFree = tonumber(redis.call('GET', KEYS[1]) or '0')
local slot = math.max(now, nextFree)
redis.call('SET', KEYS[1], slot + gap, 'PX', (slot - now) + gap + 60000)
return slot
`;

redis.defineCommand('reserveHourWindow', { numberOfKeys: 0, lua: RESERVE_WINDOW_LUA });
redis.defineCommand('reserveSendSlot', { numberOfKeys: 1, lua: RESERVE_SLOT_LUA });

type LimiterRedis = typeof redis & {
  reserveHourWindow(...args: (string | number)[]): Promise<[number, number, number, number]>;
  reserveSendSlot(key: string, now: number, gap: number): Promise<number>;
};
const r = redis as LimiterRedis;

export type LimitReason = 'none' | 'sender' | 'campaign';

export interface WindowReservation {
  /** Hour window the email may be sent in, or null if nothing free within the lookahead. */
  window: number | null;
  reason: LimitReason;
  senderCount: number;
  campaignCount: number;
}

const REASONS: LimitReason[] = ['none', 'sender', 'campaign'];

export async function reserveHourWindow(params: {
  senderId: string;
  campaignId: string;
  campaignHourlyLimit: number;
  fromWindow: number;
}): Promise<WindowReservation> {
  const [window, reason, senderCount, campaignCount] = await r.reserveHourWindow(
    `rl:sender:${params.senderId}:`,
    `rl:campaign:${params.campaignId}:`,
    params.fromWindow,
    env.MAX_EMAILS_PER_HOUR_PER_SENDER,
    Math.min(params.campaignHourlyLimit, env.MAX_EMAILS_PER_HOUR_PER_SENDER),
    env.RATE_LIMIT_MAX_LOOKAHEAD_HOURS,
  );
  return {
    window: window < 0 ? null : window,
    reason: REASONS[reason] ?? 'none',
    senderCount,
    campaignCount,
  };
}

export async function reserveSendSlot(senderId: string, now = Date.now()): Promise<number> {
  if (env.MIN_DELAY_BETWEEN_SENDS_MS === 0) return now;
  return r.reserveSendSlot(`throttle:sender:${senderId}`, now, env.MIN_DELAY_BETWEEN_SENDS_MS);
}

/** Current usage for a sender in a window (for UI / debugging). */
export async function senderUsage(senderId: string, window: number): Promise<number> {
  return Number((await redis.get(`rl:sender:${senderId}:${window}`)) ?? 0);
}
