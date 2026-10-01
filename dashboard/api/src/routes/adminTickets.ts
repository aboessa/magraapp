import { Hono } from 'hono';
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts';
import { queryFirst } from '../lib/db.ts';

type AppEnv = { Bindings: Env };

export const adminTicketsRoute = new Hono<AppEnv>();

adminTicketsRoute.use('*', requireAdmin);

interface Ticket {
  id: string;
  parent_email: string;
  parent_name: string;
  subject: string;
  category: 'billing' | 'technical' | 'content_inquiry' | 'parental_controls';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved';
  message: string;
  reply_note?: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_TICKETS: Ticket[] = [
  {
    id: 't_101',
    parent_email: 'fatima.almansoor@gmail.com',
    parent_name: 'فاطمة المنصور',
    subject: 'طلب استرجاع رمز PIN الخاص بالتحكم الأبوي',
    category: 'parental_controls',
    priority: 'high',
    status: 'open',
    message: 'نسيت رمز الـ PIN الخاص بضبط وقت الشاشة لطفلي، هل يمكنكم إعادة ضبطه؟',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 't_102',
    parent_email: 'khalid.saud@outlook.com',
    parent_name: 'خالد بن سعود',
    subject: 'خصم الاشتراك مرتين عن طريق المتجر',
    category: 'billing',
    priority: 'urgent',
    status: 'in_progress',
    message: 'تم خصم باقة العائلة بلس مرتين في متجر Google Play، أرجو مراجعة العمليات.',
    reply_note: 'جاري التحقق من كود الإيصال في سجل الفوترة.',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 1).toISOString(),
  },
  {
    id: 't_103',
    parent_email: 'nour.hassan@yahoo.com',
    parent_name: 'نور حسن',
    subject: 'اقتراح إضافة قصص تفاعلية لتعليم حروف الهجاء',
    category: 'content_inquiry',
    priority: 'medium',
    status: 'resolved',
    message: 'أعجبنا التطبيق جداً ونتمنى زيادة محتوى الحروف في مسار 3-5.',
    reply_note: 'تمت إحالة الاقتراح لفريق الإنتاج وإطلاق 4 قصص جديدة.',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
];

adminTicketsRoute.get('/tickets', async (c) => {
  try {
    const row = await queryFirst<{ value: string }>(
      c.env.DB,
      "SELECT value FROM remote_config WHERE key = 'support_tickets_list' LIMIT 1"
    );
    let tickets = DEFAULT_TICKETS;
    if (row && row.value) {
      tickets = JSON.parse(row.value);
    }
    const openCount = tickets.filter((t) => t.status === 'open').length;
    const inProgressCount = tickets.filter((t) => t.status === 'in_progress').length;
    const resolvedCount = tickets.filter((t) => t.status === 'resolved').length;

    return c.json({
      success: true,
      data: tickets,
      meta: {
        total: tickets.length,
        open: openCount,
        in_progress: inProgressCount,
        resolved: resolvedCount,
      },
    });
  } catch (_e) {
    return c.json({ success: true, data: DEFAULT_TICKETS, meta: { total: 3, open: 1, in_progress: 1, resolved: 1 } });
  }
});

adminTicketsRoute.patch('/tickets/:id', requirePermission('edit_metadata'), async (c) => {
  const id = c.req.param('id');
  let body: Partial<Ticket>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'JSON payload is required' }, 400);
  }

  const row = await queryFirst<{ value: string }>(
    c.env.DB,
    "SELECT value FROM remote_config WHERE key = 'support_tickets_list' LIMIT 1"
  );
  let tickets: Ticket[] = DEFAULT_TICKETS;
  if (row && row.value) {
    try {
      tickets = JSON.parse(row.value);
    } catch {
      tickets = DEFAULT_TICKETS;
    }
  }

  const ticketIndex = tickets.findIndex((t) => t.id === id);
  if (ticketIndex === -1) {
    return c.json({ success: false, error: 'Ticket not found' }, 404);
  }

  tickets[ticketIndex] = {
    ...tickets[ticketIndex],
    ...body,
    updated_at: new Date().toISOString(),
  };

  const jsonStr = JSON.stringify(tickets);
  await c.env.DB.prepare(
    `INSERT INTO remote_config (key, value, updated_at)
     VALUES ('support_tickets_list', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = datetime('now')`
  ).bind(jsonStr).run();

  return c.json({ success: true, data: tickets[ticketIndex] });
});
