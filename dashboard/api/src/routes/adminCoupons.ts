import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts';
import { actorId, auditStatement } from '../lib/auditLog.ts';

type AppEnv = { Bindings: Env };
const route = new Hono<AppEnv>();

export interface CouponItem {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed_amount' | 'free_days';
  discount_value: number;
  currency?: string;
  applicable_plan: 'all' | 'family' | 'family_plus';
  max_redemptions: number | null;
  times_redeemed: number;
  starts_at?: string | null;
  expires_at?: string | null;
  affiliate_name?: string | null;
  affiliate_commission_rate?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// GET /coupons — list all coupons and performance metrics
route.get('/coupons', requireAdmin, async (c) => {
  const rows = await queryAll<{ key: string; value_json: string; updated_at: string }>(
    c.env.DB,
    `SELECT key, value_json, updated_at FROM remote_config WHERE key LIKE 'coupon:%' ORDER BY updated_at DESC`
  );

  const coupons: CouponItem[] = [];
  for (const r of rows) {
    try {
      const parsed = JSON.parse(r.value_json) as CouponItem;
      coupons.push(parsed);
    } catch {
      // ignore malformed
    }
  }

  const activeCount = coupons.filter(cp => cp.is_active).length;
  const totalRedemptions = coupons.reduce((sum, cp) => sum + (cp.times_redeemed || 0), 0);
  const totalAffiliates = coupons.filter(cp => cp.affiliate_name).length;

  return c.json({
    success: true,
    data: coupons,
    meta: {
      total: coupons.length,
      active: activeCount,
      total_redemptions: totalRedemptions,
      total_affiliates: totalAffiliates,
    },
  });
});

// POST /coupons — create coupon
route.post('/coupons', requireAdmin, requirePermission('manage_billing'), async (c) => {
  const body = await c.req.json() as Record<string, unknown>;
  const rawCode = String(body.code ?? '').trim().toUpperCase();
  if (!rawCode) return c.json({ success: false, error: 'كود الكوبون مطلوب' }, 400);

  const key = `coupon:${rawCode}`;
  const existing = await queryFirst(c.env.DB, `SELECT key FROM remote_config WHERE key = ?`, [key]);
  if (existing) return c.json({ success: false, error: 'كود الكوبون مستخدم مسبقاً' }, 409);

  const discountType = String(body.discount_type ?? 'percentage');
  const discountVal = Number(body.discount_value ?? 0);
  if (discountVal <= 0) return c.json({ success: false, error: 'قيمة الخصم يجب أن تكون أكبر من صفر' }, 400);

  const coupon: CouponItem = {
    id: crypto.randomUUID(),
    code: rawCode,
    discount_type: discountType as any,
    discount_value: discountVal,
    currency: String(body.currency ?? 'USD'),
    applicable_plan: (body.applicable_plan as any) || 'all',
    max_redemptions: body.max_redemptions ? Number(body.max_redemptions) : null,
    times_redeemed: 0,
    starts_at: body.starts_at ? String(body.starts_at) : null,
    expires_at: body.expires_at ? String(body.expires_at) : null,
    affiliate_name: body.affiliate_name ? String(body.affiliate_name).trim() : null,
    affiliate_commission_rate: body.affiliate_commission_rate ? Number(body.affiliate_commission_rate) : 0,
    is_active: body.is_active !== false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await c.env.DB.prepare(
    `INSERT INTO remote_config (key, value_json, updated_at) VALUES (?, ?, datetime('now'))`
  ).bind(key, JSON.stringify(coupon)).run();

  await auditStatement(c.env.DB, actorId(c), 'create_coupon', 'coupon', rawCode, {
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value,
    affiliate_name: coupon.affiliate_name,
  }).run();

  return c.json({ success: true, data: coupon }, 201);
});

// PATCH /coupons/:code — update coupon
route.patch('/coupons/:code', requireAdmin, requirePermission('manage_billing'), async (c) => {
  const code = c.req.param('code')!.toUpperCase();
  const key = `coupon:${code}`;
  const existing = await queryFirst<{ value_json: string }>(c.env.DB, `SELECT value_json FROM remote_config WHERE key = ?`, [key]);
  if (!existing) return c.json({ success: false, error: 'الكوبون غير موجود' }, 404);

  const current = JSON.parse(existing.value_json) as CouponItem;
  const body = await c.req.json() as Record<string, unknown>;

  const updated: CouponItem = {
    ...current,
    is_active: typeof body.is_active === 'boolean' ? body.is_active : current.is_active,
    discount_value: body.discount_value !== undefined ? Number(body.discount_value) : current.discount_value,
    discount_type: (body.discount_type as any) || current.discount_type,
    max_redemptions: body.max_redemptions !== undefined ? (body.max_redemptions ? Number(body.max_redemptions) : null) : current.max_redemptions,
    expires_at: body.expires_at !== undefined ? (body.expires_at ? String(body.expires_at) : null) : current.expires_at,
    affiliate_name: body.affiliate_name !== undefined ? (body.affiliate_name ? String(body.affiliate_name).trim() : null) : current.affiliate_name,
    affiliate_commission_rate: body.affiliate_commission_rate !== undefined ? Number(body.affiliate_commission_rate) : current.affiliate_commission_rate,
    updated_at: new Date().toISOString(),
  };

  await c.env.DB.prepare(
    `UPDATE remote_config SET value_json = ?, updated_at = datetime('now') WHERE key = ?`
  ).bind(JSON.stringify(updated), key).run();

  await auditStatement(c.env.DB, actorId(c), 'update_coupon', 'coupon', code, {
    is_active: updated.is_active,
  }).run();

  return c.json({ success: true, data: updated });
});

// DELETE /coupons/:code — delete coupon
route.delete('/coupons/:code', requireAdmin, requirePermission('manage_billing'), async (c) => {
  const code = c.req.param('code')!.toUpperCase();
  const key = `coupon:${code}`;
  await c.env.DB.prepare(`DELETE FROM remote_config WHERE key = ?`).bind(key).run();

  await auditStatement(c.env.DB, actorId(c), 'delete_coupon', 'coupon', code, {}).run();
  return c.json({ success: true });
});

export default route;
