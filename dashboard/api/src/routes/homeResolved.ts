import { Hono } from 'hono'
import type { Env } from '../lib/db.ts'
import { queryAll } from '../lib/db.ts'
import {
  homeContextFromQuery,
  resolveHomeBlocks,
} from '../lib/homeExperience.ts'
import type { HomeBlockRow, ResolvedHomeBlock } from '../lib/homeExperience.ts'

type AppEnv = { Bindings: Env }
const route = new Hono<AppEnv>()

/**
 * The Home screen configuration the app renders.
 *
 * `GET /api/v1/home/resolved?track=&language=&country=&plan=&platform=&app_version=`
 *
 * No authentication: the child's Home layout is not secret, and the targeting
 * dimensions arrive as query parameters derived from the child profile the app
 * already holds. Nothing here reads content — this endpoint answers "which rows,
 * in what order", and each row's items are fetched by the client from the
 * catalogue endpoints that do enforce entitlement and territory.
 *
 * Resolution is `lib/homeExperience.ts`, shared with the admin preview so the two
 * cannot disagree.
 */

/**
 * The layout served when the database has no usable configuration.
 *
 * Deliberately minimal: a hero and the explore rail, both of which render from
 * the catalogue the client already has. It exists so a configuration outage
 * degrades to a working Home rather than a blank screen.
 *
 * It is marked `fallback: true` in the response. The previous implementation
 * returned the same shape as a configured Home, so a client — and an operator
 * reading a network trace — could not tell a resolved layout from a fallback, and
 * a broken D1 query looked exactly like a deliberately short Home.
 */
const FALLBACK_BLOCKS: ResolvedHomeBlock[] = [
  {
    id: 'fallback-hero',
    type: 'hero_slider',
    title: null,
    subtitle: null,
    source: 'editorial',
    card_style: null,
    config: {},
    targeting: {},
    position: 0,
    is_system: false,
  },
  {
    id: 'fallback-explore',
    type: 'explore_majarra',
    title: null,
    subtitle: null,
    source: 'system',
    card_style: null,
    config: {},
    targeting: {},
    position: 1,
    is_system: true,
  },
]

route.get('/resolved', async (c) => {
  const context = homeContextFromQuery((key) => c.req.query(key))
  const nowIso = new Date().toISOString()

  let rows: HomeBlockRow[] | null = null
  try {
    rows = await queryAll<HomeBlockRow>(c.env.DB, `
      SELECT id, block_type, title_ar, sort_order, is_active, is_draft,
             scheduled_at, expires_at, version, targeting_json, config_json
        FROM home_experience_blocks
    `)
  } catch (error) {
    // A failed read is reported as a failed read. The previous handler caught the
    // error, retried against an older schema, caught again, set `rows = []` and
    // then served the fallback with a success envelope — so a broken query was
    // indistinguishable from an empty configuration for both the app and whoever
    // was debugging it.
    console.error('home_resolved_query_failed', error instanceof Error ? error.message : String(error))
  }

  const blocks = rows === null ? [] : resolveHomeBlocks(rows, context, nowIso)
  const usingFallback = blocks.length === 0

  return c.json({
    success: true,
    data: {
      blocks: usingFallback ? FALLBACK_BLOCKS : blocks,
      meta: {
        ...context,
        resolved_at: nowIso,
        /// The client keys its own fallback notice off this rather than guessing
        /// from the block count.
        fallback: usingFallback,
        fallback_reason: rows === null
          ? 'configuration_unavailable'
          : usingFallback ? 'no_blocks_matched' : null,
        configured_blocks: rows?.length ?? 0,
      },
    },
  })
})

export default route
