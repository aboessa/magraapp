import { apiRoot } from './api'
import { readAdminActor, readAdminToken } from './adminSession'

export type CreativeStudioResult = {
  success: boolean
  data?: any
  error?: string
  meta?: unknown
}

export async function creativeStudioAdmin(path: string, init?: RequestInit): Promise<CreativeStudioResult> {
  const token = readAdminToken()
  const actor = readAdminActor()
  const isForm = init?.body instanceof FormData
  const headers = new Headers(init?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (actor) headers.set('X-Admin-Actor', actor)
  if (!isForm) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${apiRoot}/admin${path}`, {
    ...init,
    headers,
  })
  const body = await response.json().catch(() => ({ success: false, error: response.statusText })) as CreativeStudioResult
  return { ...body, success: response.ok && body.success !== false }
}

export async function creativeStudioPublic(path: string): Promise<CreativeStudioResult> {
  const response = await fetch(`${apiRoot}${path}`)
  const body = await response.json().catch(() => ({ success: false, error: response.statusText })) as CreativeStudioResult
  return { ...body, success: response.ok && body.success !== false }
}
