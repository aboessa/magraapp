import type { Env } from '../lib/db.ts';
import { callDurable, familyStub } from '../lib/doClient.ts';
import { sha256Base64Url } from '../lib/security.ts';
import { verifyGooglePlaySubscription } from './googlePlay.ts';

type Envelope<T> = { success: boolean; data?: T; error?: string };

export async function verifyAuditAndApplyGooglePlay(env: Env, parentId: string, purchaseToken: string) {
  const verifiedAt = Date.now();
  const verified = await verifyGooglePlaySubscription(env, parentId, purchaseToken);
  const purchaseTokenHash = await sha256Base64Url(purchaseToken);
  const auditId = `google-play:${purchaseTokenHash}`;
  await env.DB.prepare(`
    INSERT INTO billing_audit (
      id, parent_id, provider, product_id, plan, purchase_token_hash,
      provider_purchase_id, provider_state, entitlement_status, starts_at_ms,
      expires_at_ms, raw_response_hash, verified_at_ms
    ) VALUES (?, ?, 'google_play', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(purchase_token_hash) DO UPDATE SET
      provider_purchase_id = excluded.provider_purchase_id,
      provider_state = excluded.provider_state,
      entitlement_status = excluded.entitlement_status,
      starts_at_ms = excluded.starts_at_ms,
      expires_at_ms = excluded.expires_at_ms,
      raw_response_hash = excluded.raw_response_hash,
      verified_at_ms = excluded.verified_at_ms,
      updated_at = datetime('now')
    WHERE excluded.verified_at_ms >= billing_audit.verified_at_ms
  `).bind(
    auditId,
    parentId,
    verified.productId,
    verified.plan,
    purchaseTokenHash,
    verified.providerPurchaseId,
    verified.providerState,
    verified.entitlementStatus,
    verified.startsAt,
    verified.expiresAt,
    verified.rawResponseHash,
    verifiedAt,
  ).run();

  const applied = await callDurable<Envelope<{ plan: string }>>(familyStub(env, parentId), '/entitlements/apply', {
    body: {
      id: auditId,
      source: 'google_play',
      provider_purchase_id: verified.providerPurchaseId,
      plan: verified.plan,
      status: verified.entitlementStatus,
      starts_at: verified.startsAt ?? verifiedAt,
      expires_at: verified.expiresAt,
      observed_at: verifiedAt,
    },
  });
  if (!applied.ok || !applied.data?.success) throw new Error('entitlement_projection_unavailable');
  await env.DB.prepare(`
    UPDATE billing_audit SET projection_applied_at_ms = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(Date.now(), auditId).run();

  return {
    productId: verified.productId,
    plan: applied.data.data?.plan ?? verified.plan,
    status: verified.entitlementStatus,
    expiresAt: verified.expiresAt,
  };
}
