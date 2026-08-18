import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryFirst } from '../lib/db.ts';
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
      },
    };
  }, 120);
});

export default appConfigRoute;
