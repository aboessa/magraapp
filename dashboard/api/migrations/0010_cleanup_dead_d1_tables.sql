-- Cleanup: الجداول التي انتقلت ملكيتها إلى Durable Objects أصبحت ميتة
-- هذه الجداول أنشئت في 0006/0007 وتم تطبيقها على الإنتاج، لكنها لم تعد تُكتب
-- نحتفظ بها كـ no-op حتى لا نكسر أي استعلام قديم، وسيتم إسقاطها في 0011 بعد التأكد
-- parent_credentials, account_devices, parent_auth_sessions, google_play_purchases, subscription_entitlements, playback_leases, used_refresh_tokens
-- الإجراء الحالي: لا شيء - توثيق فقط. الإسقاط الفعلي يتطلب فحص family_projection/child_projection أولاً
SELECT 1;
