import { createHash, randomUUID } from "node:crypto";
import type { DemoAccounts } from "./demo-near";
import type { Step } from "./demo-state";

export const demoCookie = "__Host-agsurance-demo";
export const hostedSteps = new Set<Step | "reconcile">([
  "buy", "refund", "loss", "submit", "review1", "review2", "review3", "pay", "reconcile",
]);

function redisConfig() {
  return {
    endpoint: process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN,
  };
}

export function hostedDemoEnabled() {
  const { endpoint, token } = redisConfig();
  return process.env.VERCEL === "1" && !!process.env.AGSURANCE_DEMO_INVITES
    && !!endpoint && !!token;
}

export function inviteAccounts(code: string | undefined): DemoAccounts | undefined {
  if (!hostedDemoEnabled() || !code || !/^[a-f0-9]{64}$/.test(code)) return;
  const hash = createHash("sha256").update(code).digest("hex");
  const invites = JSON.parse(process.env.AGSURANCE_DEMO_INVITES!) as Record<string, DemoAccounts>;
  if (Object.hasOwn(invites, hash)) return invites[hash];
}

export function hostedDemoOrigin(request: Request) {
  const host = request.headers.get("host");
  return !!host && request.headers.get("origin") === `https://${host}`;
}

export function hostedJournal(vault: string) {
  const { endpoint, token } = redisConfig();
  if (!endpoint || !token) throw new Error("The demo journal is not configured.");
  const redisUrl = endpoint;
  const prefix = `agsurance:demo:v1:${vault}:`;
  async function command<T>(args: (string | number)[]) {
    const response = await fetch(redisUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.json() as { result?: T; error?: string };
    if (!response.ok || body.error || body.result === undefined) {
      throw new Error("The demo journal is temporarily unavailable.");
    }
    return body.result;
  }

  return {
    async read<T>(key: string) {
      const value = await command<string | null>(["GET", prefix + key]);
      return value === null ? null : JSON.parse(value) as T;
    },
    async save(key: string, value: object) {
      await command(["SET", prefix + key, JSON.stringify(value)]);
    },
    async remove(key: string) {
      await command(["DEL", prefix + key]);
    },
    async acquire() {
      const key = prefix + "lock";
      const token = randomUUID();
      // The lease outlasts the maximum duration of the API request.
      if (await command(["SET", key, token, "NX", "EX", 360]) !== "OK") return;
      return async () => {
        await command(["EVAL",
          "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0",
          1, key, token]);
      };
    },
  };
}
