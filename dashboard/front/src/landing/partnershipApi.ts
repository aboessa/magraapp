/**
 * عميل مستقل لنموذج الشراكات.
 * لا يستورد lib/api.ts حتى لا تسحب حزمة الهبوط كود اللوحة وترويسات الإدارة.
 */

const API_ROOT = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')

export type PartnershipKind = 'school' | 'nursery' | 'publisher' | 'producer' | 'creator' | 'other'

export type PartnershipPayload = {
  kind: PartnershipKind
  name: string
  organization: string
  email: string
  phone?: string
  country?: string
  message: string
  locale: string
  /** فخ للبوتات: يجب أن يبقى فارغًا */
  website?: string
}

export type SubmitResult =
  | { ok: true }
  | { ok: false; reason: 'rate' | 'validation' | 'generic'; message?: string }

export async function submitPartnership(payload: PartnershipPayload): Promise<SubmitResult> {
  try {
    const response = await fetch(`${API_ROOT}/partnerships`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    })

    if (response.ok) return { ok: true }

    const body = await response.json().catch(() => null) as { error?: string } | null
    if (response.status === 429) return { ok: false, reason: 'rate' }
    if (response.status === 400) return { ok: false, reason: 'validation', message: body?.error }
    return { ok: false, reason: 'generic', message: body?.error }
  } catch {
    return { ok: false, reason: 'generic' }
  }
}
