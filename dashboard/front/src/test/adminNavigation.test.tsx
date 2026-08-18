import { describe, expect, test } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

/**
 * ÙƒÙ„ ÙˆØ¬Ù‡Ø© ØªÙ†Ù‚Ù‘Ù„ ÙÙŠ Ø§Ù„Ù„ÙˆØ­Ø© ÙŠØ¬Ø¨ Ø£Ù† ØªÙØ·Ø§Ø¨Ù‚ Ù…Ø³Ø§Ø±Ù‹Ø§ Ù…Ø¹Ù„ÙŽÙ†Ù‹Ø§.
 *
 * ## Ø§Ù„Ø®Ù„Ù„ Ø§Ù„Ø°ÙŠ ÙŠØ³Ø¯Ù‘Ù‡ Ù‡Ø°Ø§ Ø§Ù„Ø§Ø®ØªØ¨Ø§Ø±
 *
 * Ø«Ù„Ø§Ø« ÙˆØ¬Ù‡Ø§Øª ÙƒØ§Ù†Øª ØªØ´ÙŠØ± Ø¥Ù„Ù‰ Ù…Ø³Ø§Ø±Ø§Øª ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø©ØŒ Ø§Ø«Ù†ØªØ§Ù† Ù…Ù†Ù‡Ø§ Ø¹Ù„Ù‰ ØµÙ Ø§Ù„Ù…Ø¤Ø´Ù‘Ø±Ø§Øª
 * Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ ÙÙŠ Ø£Ø¹Ù„Ù‰ Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ…:
 *
 * - `subscriptions` ÙˆØ§Ù„Ù…Ø³Ø§Ø± Ø§Ù„Ù…Ø¹Ù„ÙŽÙ† `billing`
 * - `ops/sla` ÙˆØ§Ù„Ù…Ø³Ø§Ø± Ø§Ù„Ù…Ø¹Ù„ÙŽÙ† `ops-sla`
 * - `ops/services` Ø¨Ù„Ø§ Ù…Ø³Ø§Ø± ÙÙ‡Ø±Ø³ØŒ Ø¥Ù†Ù…Ø§ `ops/services/:id` ÙÙ‚Ø·
 *
 * Ø§Ù„Ù†Ù‚Ø± Ø¹Ù„ÙŠÙ‡Ø§ ÙŠÙØªØ­ Ø­Ø§Ù„Ø© Â«ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Â»ØŒ ÙˆÙ„Ø§ Ø´ÙŠØ¡ ÙÙŠ Ø§Ù„Ø¨Ù†Ø§Ø¡ Ø£Ùˆ Ø§Ù„Ø£Ù†ÙˆØ§Ø¹ ÙŠÙ…Ù†Ø¹ Ø°Ù„Ùƒ:
 * `adminPath()` ØªÙ‚Ø¨Ù„ Ø£ÙŠ Ù†Øµ. Ø§Ù„Ø§Ø®ØªØ¨Ø§Ø± ÙŠÙ‚Ø±Ø£ Ø¬Ø¯ÙˆÙ„ Ø§Ù„Ù…Ø³Ø§Ø±Ø§Øª Ù…Ù† `AdminRoutes.tsx`
 * ÙˆÙŠÙ‚Ø§Ø±Ù†Ù‡ Ø¨ÙƒÙ„ ÙˆØ¬Ù‡Ø© Ù…ÙƒØªÙˆØ¨Ø© ÙÙŠ Ø§Ù„ØµÙØ­Ø§ØªØŒ ÙÙŠÙØ´Ù„ Ø¹Ù†Ø¯ Ø¥Ø¶Ø§ÙØ© Ø±Ø§Ø¨Ø· Ù„Ø§ ÙˆØ¬Ù‡Ø© Ù„Ù‡.
 */

const SRC = path.resolve(__dirname, '..')

function declaredRoutes(): string[] {
  const source = readFileSync(path.join(SRC, 'AdminRoutes.tsx'), 'utf8')
  return [...source.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1])
}

/** `ops/services/:id` â†’ matches `ops/services/anything`, not `ops/services`. */
function routeMatches(route: string, target: string): boolean {
  const routeSegments = route.split('/')
  const targetSegments = target.split('/')
  if (routeSegments.length !== targetSegments.length) return false
  return routeSegments.every((segment, index) => (
    segment.startsWith(':') ? targetSegments[index].length > 0 : segment === targetSegments[index]
  ))
}

/** Navigation targets written as literals, which is the only case a test can check. */
function literalTargets(): Array<{ file: string; target: string }> {
  const found: Array<{ file: string; target: string }> = []
  const roots = [path.join(SRC, 'pages'), path.join(SRC, 'components')]

  for (const root of roots) {
    for (const name of readdirSync(root)) {
      if (!name.endsWith('.tsx')) continue
      const source = readFileSync(path.join(root, name), 'utf8')

      // adminPath('literal') â€” template literals with ${} are skipped on purpose:
      // their value is not known statically.
      for (const match of source.matchAll(/adminPath\(\s*'([^'${}]+)'\s*\)/g)) {
        found.push({ file: name, target: match[1] })
      }
      // <Card href="literal"> on the KPI row.
      for (const match of source.matchAll(/href="([a-z0-9][a-z0-9/-]*)"/gi)) {
        found.push({ file: name, target: match[1] })
      }
    }
  }

  return found
}

describe('admin navigation targets', () => {
  const routes = declaredRoutes()

  test('reads a real route table', () => {
    expect(routes.length).toBeGreaterThan(80)
    expect(routes).toContain('billing')
    expect(routes).toContain('ops-sla')
  })

  test('finds the navigation targets it claims to check', () => {
    const targets = literalTargets()
    expect(targets.length).toBeGreaterThan(30)
  })

  test('every literal navigation target resolves to a declared route', () => {
    const unresolved = literalTargets()
      // A query string or fragment is state for the destination, not part of the
      // path: `billing?tab=subscriptions` is the `billing` route.
      .map(({ file, target }) => ({ file, target: target.split(/[?#]/)[0] }))
      .filter(({ target }) => target !== '' && target !== '/')
      .filter(({ target }) => !routes.some((route) => routeMatches(route, target)))
      .map(({ file, target }) => `${file} â†’ ${target}`)

    expect(unresolved).toEqual([])
  })
})
