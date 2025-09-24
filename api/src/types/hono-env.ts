/**
 * Hono environment type definitions for Cloudflare Workers
 */
import type { Env } from './env';

/**
 * Hono context environment for Cloudflare Workers
 */
export interface HonoEnv {
  Bindings: Env;
}

/**
 * Type-safe environment access helper
 */
export function getEnv(c: { env: unknown }): Env {
  return c.env as Env;
}