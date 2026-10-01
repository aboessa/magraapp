import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { cachedPublicJson } from '../lib/publicCache.ts';

type AppEnv = { Bindings: Env };

const appConfigRoute = new Hono<AppEnv>();

// Public app config — no auth, cached. Only exposes keys safe for clients.
appConfigRoute.get('/', async (c) => {
  return cachedPublicJson(c.req.raw, c.env.CACHE, async () => {
    const rows = await Promise.all([
      queryFirst<{ value_json: string }>(c.env.DB, `SELECT value_json FROM remote_config WHERE key = 'min_app_version'`),
      queryFirst<{ value_json: string }>(c.env.DB, `SELECT value_json FROM remote_config WHERE key = 'maintenance_message'`),
      queryFirst<{ value_json: string }>(c.env.DB, `SELECT value_json FROM remote_config WHERE key = 'forced_update_url'`),
    ]);
    // ADM-305: on/off flags for the app. Targeting is not evaluated here (this
    // response is public and cached), so a flag is either on for everyone or off.
    const flags = await queryAll<{ key: string; enabled: number }>(c.env.DB, `SELECT key, enabled FROM feature_flags`)
      .catch(() => [] as Array<{ key: string; enabled: number }>);
    const parse = (v: string | undefined) => {
      if (!v) return null;
      try { return JSON.parse(v); } catch { return v; }
    };
    return {
      success: true,
      data: {
        min_app_version: parse(rows[0]?.value_json) ?? null,
        maintenance_message: parse(rows[1]?.value_json) ?? null,
        forced_update_url: parse(rows[2]?.value_json) ?? null,
        feature_flags: Object.fromEntries(flags.map((flag) => [flag.key, Number(flag.enabled) === 1])),
      },
    };
  }, 120);
});

export default appConfigRoute;
