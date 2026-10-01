import { describe, expect, test } from 'vitest'
import { render } from '@testing-library/react'
import { renderLegalBody } from '../pages/LegalPage'

/// The legal body is rendered as React text, never as HTML.
describe('renderLegalBody', () => {
  test('headings, bullets, steps and paragraphs', () => {
    const { container } = render(<div>{renderLegalBody('## من نحن\nفقرة أولى\nتكملة\n\n- نقطة\n- نقطة ثانية\n\n1. خطوة\n2. خطوة ثانية')}</div>)
    expect(container.querySelector('h2')?.textContent).toBe('من نحن')
    expect(container.querySelector('p')?.textContent).toBe('فقرة أولى تكملة')
    expect(container.querySelectorAll('ul li')).toHaveLength(2)
    expect(container.querySelectorAll('ol li')).toHaveLength(2)
  })

  test('markup in the body stays text', () => {
    const { container } = render(<div>{renderLegalBody('<img src=x onerror=alert(1)>\n- <b>bold</b>')}</div>)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
  })
})
