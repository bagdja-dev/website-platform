import crypto from 'node:crypto';

import { Redis } from '@upstash/redis';

const STATE_KEY_PREFIX = 'website-platform:oauth-state:';
const STATE_TTL_SECONDS = 600;

export type OAuthStatePayload = {
  codeVerifier: string;
  nextPath: string | null;
};

let redisClient: Redis | null | undefined;
const memoryStore = new Map<
  string,
  { payload: OAuthStatePayload; expiresAt: number }
>();

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redisClient =
    url?.startsWith('https://') && token
      ? new Redis({ url, token })
      : null;
  return redisClient;
}

function purgeExpiredMemoryEntries(): void {
  const now = Date.now();
  for (const [key, value] of memoryStore) {
    if (value.expiresAt <= now) memoryStore.delete(key);
  }
}

export function generateStateId(): string {
  return crypto.randomBytes(18).toString('base64url');
}

export async function saveOAuthState(
  state: string,
  payload: OAuthStatePayload,
): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    await redis.set(`${STATE_KEY_PREFIX}${state}`, payload, {
      ex: STATE_TTL_SECONDS,
    });
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Upstash Redis must be configured for production OAuth state');
  }

  purgeExpiredMemoryEntries();
  memoryStore.set(`${STATE_KEY_PREFIX}${state}`, {
    payload,
    expiresAt: Date.now() + STATE_TTL_SECONDS * 1000,
  });
}

export async function consumeOAuthState(
  state: string,
): Promise<OAuthStatePayload | null> {
  const redis = getRedisClient();
  if (redis) {
    const raw = await redis.getdel<OAuthStatePayload | string>(
      `${STATE_KEY_PREFIX}${state}`,
    );
    if (!raw) return null;

    const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return isOAuthStatePayload(payload) ? payload : null;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Upstash Redis must be configured for production OAuth state');
  }

  purgeExpiredMemoryEntries();
  const key = `${STATE_KEY_PREFIX}${state}`;
  const entry = memoryStore.get(key);
  memoryStore.delete(key);
  return entry && entry.expiresAt > Date.now() ? entry.payload : null;
}

function isOAuthStatePayload(value: unknown): value is OAuthStatePayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<OAuthStatePayload>;
  return (
    typeof payload.codeVerifier === 'string' &&
    (typeof payload.nextPath === 'string' || payload.nextPath === null)
  );
}

