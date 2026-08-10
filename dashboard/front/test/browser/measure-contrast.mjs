/**
 * Measures the exact contrast ratio axe flagged, so the fix is informed rather than guessed.
 *
 * Prints the computed foreground, the composited background and the ratio for the elements
 * named in the axe report, in both themes.
 */

import { chromium } from 'playwright'

const FRONT = (process.argv[2] ?? 'http://localhost:5174').replace(/\/$/, '')
const ADMIN_BASE = '/iamnotsite'
const EMAIL = process.argv[3]
const PASSWORD = process.argv[4]
/// Route and selectors come from the command line, so any violation axe reports can be
/// measured without editing this file. Hard-coding one route and four badge selectors made
/// the tool answer only the question it was written for.
const ROUTE = process.argv[5] ?? 'audit-logs'
const SELECTORS = (process.argv[6] ?? '.status-badge--archived,.status-badge--draft,.status-badge--review,.status-badge--published')
  .split(',').map((value) => value.trim()).filter(Boolean)

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()

await page.goto(`${FRONT}${ADMIN_BASE}`, { waitUntil: 'networkidle' })
if (await page.locator('input[type="email"]').first().isVisible().catch(() => false)) {
  await page.locator('input[type="email"]').first().fill(EMAIL)
  await page.locator('input[type="password"]').first().fill(PASSWORD)
  await page.locator('form button[type="submit"]').first().click()
  await page.waitForSelector('.sidebar')
}

for (const theme of ['dark', 'light']) {
  await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
  await page.goto(`${FRONT}${ADMIN_BASE}/${ROUTE}`, { waitUntil: 'networkidle' })
  await page.evaluate((value) => { document.documentElement.dataset.theme = value }, theme)
  await page.waitForTimeout(400)

  const measured = await page.evaluate((selectors) => {
    const parse = (value) => {
      const match = value.match(/rgba?\(([^)]+)\)/)
      if (!match) return null
      const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()))
      return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 }
    }
    const over = (front, back) => ({
      r: front.r * front.a + back.r * (1 - front.a),
      g: front.g * front.a + back.g * (1 - front.a),
      b: front.b * front.a + back.b * (1 - front.a),
      a: 1,
    })
    const luminance = ({ r, g, b }) => {
      const channel = (value) => {
        const scaled = value / 255
        return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    }
    const backgroundOf = (element) => {
      let stack = []
      let node = element
      while (node) {
        const colour = parse(getComputedStyle(node).backgroundColor)
        if (colour && colour.a > 0) stack.push(colour)
        if (colour && colour.a === 1) break
        node = node.parentElement
      }
      let result = stack.pop() ?? { r: 255, g: 255, b: 255, a: 1 }
      while (stack.length) result = over(stack.pop(), result)
      return result
    }

    const report = []
    for (const selector of selectors) {
      const element = document.querySelector(selector)
      if (!element) continue
      const style = getComputedStyle(element)
      const front = over(parse(style.color), backgroundOf(element))
      const back = backgroundOf(element)
      const lighter = Math.max(luminance(front), luminance(back))
      const darker = Math.min(luminance(front), luminance(back))
      report.push({
        selector,
        color: style.color,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        background: `rgb(${Math.round(back.r)}, ${Math.round(back.g)}, ${Math.round(back.b)})`,
        ratio: Number((((lighter + 0.05) / (darker + 0.05))).toFixed(2)),
      })
    }
    return report
  }, SELECTORS)

  process.stdout.write(`\n--- ${theme} ---\n`)
  for (const item of measured) {
    process.stdout.write(`${item.selector.padEnd(28)} ${item.color} on ${item.background} ${item.fontSize}/${item.fontWeight} => ${item.ratio}:1\n`)
  }
}

await browser.close()
