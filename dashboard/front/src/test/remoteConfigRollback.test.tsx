import { describe, expect, test, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RemoteConfigPage } from '../pages/RemoteConfigPage'
import { AppExperiencePage } from '../pages/AppExperiencePage'
import { api } from '../lib/api'
import { renderWithProviders } from './harness'

/// ADM-308: the remote-config Rollback button was a bare `disabled`, and the
/// home builder's Import had a textarea and no action.

function stubRemoteConfig(history: unknown[]) {
  vi.spyOn(api, 'remoteConfig').mockResolvedValue({ success: true, data: [] } as never)
  vi.spyOn(api, 'featureFlags').mockResolvedValue({ success: true, data: [] } as never)
  vi.spyOn(api, 'remoteConfigHistory').mockResolvedValue({ success: true, data: history } as never)
}

const change = (over: Record<string, unknown> = {}) => ({
  id: 'audit-2', key: 'min_app_version', actor_id: 'admin-1', action: 'update',
  created_at: '2026-09-29T10:00:00Z', restorable: true, reason: 'release',
  before: { value: '0.1.0', rollout_percent: 100 }, after: { value: '0.2.0', rollout_percent: 100 },
  ...over,
})

describe('Remote config rollback', () => {
  test('a restorable change rolls back with its id and a reason', async () => {
    stubRemoteConfig([change()])
    const rollback = vi.spyOn(api, 'rollbackRemoteConfig').mockResolvedValue({ success: true, data: { key: 'min_app_version', restored_from: 'audit-2' } } as never)
    renderWithProviders(<RemoteConfigPage />)

    await userEvent.click(await screen.findByRole('button', { name: /السجل|History/ }))
    expect(await screen.findByText('"0.1.0" → "0.2.0"')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /^استرجاع$|^Roll back$/ }))

    const confirm = (await screen.findAllByRole('button', { name: /^استرجاع$|^Roll back$/ })).at(-1)!
    await userEvent.click(confirm)
    expect(await screen.findByRole('alert')).toBeTruthy() // reason required
    expect(rollback).not.toHaveBeenCalled()

    await userEvent.type(screen.getByRole('textbox', { name: /السبب|Reason/ }), 'broke old phones')
    await userEvent.click(confirm)
    await waitFor(() => expect(rollback).toHaveBeenCalledWith('min_app_version', 'audit-2', 'broke old phones'))
  })

  test('an old change without the previous value is shown, not offered', async () => {
    stubRemoteConfig([change({ restorable: false, before: null, reason: null })])
    renderWithProviders(<RemoteConfigPage />)
    await userEvent.click(await screen.findByRole('button', { name: /السجل|History/ }))
    expect(await screen.findByText(/مش متسجّل قيمته السابقة|previous value not recorded/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^استرجاع$|^Roll back$/ })).toBeNull()
    expect(document.querySelector('button[disabled]')?.textContent ?? '').not.toMatch(/Rollback/)
  })
})

describe('Home layout import', () => {
  test('updates known blocks, creates new ones, then applies the file order', async () => {
    const existing = {
      id: 'a', block_type: 'games', title_ar: 'ألعاب', sort_order: 0, is_active: 1, is_draft: 0,
      scheduled_at: null, expires_at: null, version: 1, targeting: {}, config: {}, is_system: false,
      targeting_invalid: null, config_invalid: null,
    }
    vi.spyOn(api, 'homeExperience').mockResolvedValue({
      success: true, data: [existing],
      meta: { block_types: ['games', 'hero_slider'], system_block_types: [], targeting_dimensions: [], config_keys: [] },
    } as never)
    vi.spyOn(api, 'homeExperiencePreview').mockRejectedValue(new Error('no preview'))
    const update = vi.spyOn(api, 'updateHomeBlock').mockResolvedValue({ success: true, data: existing } as never)
    const create = vi.spyOn(api, 'createHomeBlock').mockResolvedValue({ success: true, data: { id: 'new-1' } } as never)
    const reorder = vi.spyOn(api, 'reorderHomeBlocks').mockResolvedValue({ success: true, data: { order: [] } } as never)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderWithProviders(<AppExperiencePage />)
    await userEvent.click(await screen.findByRole('button', { name: /تصدير \/ استيراد|Export \/ Import/ }))
    const box = await waitFor(() => document.querySelector('textarea') as HTMLTextAreaElement)
    await userEvent.clear(box)
    await userEvent.click(box)
    await userEvent.paste(JSON.stringify([
      { block_type: 'hero_slider', title_ar: 'هيرو', is_active: 1 },
      { id: 'a', block_type: 'games', title_ar: 'ألعاب جديدة', is_active: 1 },
    ]))
    await userEvent.click(screen.getByRole('button', { name: /استيراد وتطبيق|Import & apply/ }))

    await waitFor(() => expect(reorder).toHaveBeenCalledWith(['new-1', 'a']))
    expect(create.mock.calls[0][0]).toMatchObject({ block_type: 'hero_slider', title_ar: 'هيرو' })
    expect(update).toHaveBeenCalledWith('a', expect.objectContaining({ title_ar: 'ألعاب جديدة' }))
  })

  test('invalid JSON is refused before anything is written', async () => {
    vi.spyOn(api, 'homeExperience').mockResolvedValue({
      success: true, data: [], meta: { block_types: [], system_block_types: [], targeting_dimensions: [], config_keys: [] },
    } as never)
    vi.spyOn(api, 'homeExperiencePreview').mockRejectedValue(new Error('no preview'))
    const create = vi.spyOn(api, 'createHomeBlock')
    renderWithProviders(<AppExperiencePage />)
    await userEvent.click(await screen.findByRole('button', { name: /تصدير \/ استيراد|Export \/ Import/ }))
    const box = await waitFor(() => document.querySelector('textarea') as HTMLTextAreaElement)
    await userEvent.clear(box)
    await userEvent.type(box, 'not json')
    await userEvent.click(screen.getByRole('button', { name: /استيراد وتطبيق|Import & apply/ }))
    expect(await screen.findByText(/JSON غير صالح|Invalid JSON/)).toBeTruthy()
    expect(create).not.toHaveBeenCalled()
  })
})
