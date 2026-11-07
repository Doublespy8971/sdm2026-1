import { type AppEnv, AppEnvSchema } from "@sdm/core/shared";

/** Runtime environment, read once at startup. Railway provides RAILWAY_GIT_COMMIT_SHA on deploys. */
export const APP_ENV: AppEnv = AppEnvSchema.catch("local").parse(process.env.APP_ENV);
export const GIT_SHA: string = process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? "dev";
export const PORT: number = Number(process.env.PORT ?? 2567);
export const STARTED_AT: string = new Date().toISOString();

/**
 * How many proxies sit in front of the server: 1 when Railway's edge serves it directly, 2 behind the
 * gateway (Railway's edge, then the gateway). It decides which address `req.ip` is, and the per-IP rate limits
 * use it, so a wrong value either blocks every player together or lets a client pick its own address.
 * A bad value stops the server at startup instead of quietly falling back.
 */
export const TRUST_PROXY_HOPS: number = readTrustProxyHops(process.env.TRUST_PROXY_HOPS);

export function readTrustProxyHops(value: string | undefined): number {
  if (value === undefined || value === "") return 1;
  const hops = Number(value);
  if (!Number.isInteger(hops) || hops < 1 || hops > 3) {
    throw new Error(`TRUST_PROXY_HOPS must be 1, 2 or 3 (got "${value}").`);
  }
  return hops;
}
