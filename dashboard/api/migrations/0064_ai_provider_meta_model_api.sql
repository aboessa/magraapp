-- Meta Model API as a registry provider.
--
-- ## Why this is a new migration rather than an edit to 0063
--
-- 0063 is already applied. A migration is a record of what ran, so editing it would make
-- the file disagree with `d1_migrations` locally and diverge from whatever ran in
-- production. Additive change, new file.
--
-- ## Why no new adapter was needed
--
-- Meta Model API is documented as OpenAI-compatible: Chat Completions at
-- `https://api.meta.ai/v1/chat/completions` with `Authorization: Bearer`, and
-- `response_format` for structured output. So `services/aiText.ts` reaches it through the
-- same OpenAI-shaped request it already sends, and the slug is mapped to that wire
-- protocol explicitly rather than falling into it as a default.
--
-- Source: Meta Model API documentation, models and chat-completions pages.
-- https://ai.developer.meta.com/docs/models/
-- https://ai.developer.meta.com/docs/protocols/chat-completions/
--
-- ## What is deliberately NOT seeded here
--
-- No model rows. Muse Spark ships as `muse-spark-1.1`, `muse-spark-1.2` and
-- `muse-spark-1.2-contributor`, and those strings move with each release. They are added
-- from the dashboard and proven with the probe, which is the only thing that establishes
-- a model id is real. The contributor tier in particular is a policy decision, not a
-- default: it is cheaper in exchange for permission to train on the prompts and
-- completions sent to it, which for children story drafts is an editorial call the
-- platform owner has to make, not a migration.

INSERT OR IGNORE INTO ai_providers (id, slug, name_ar, auth_mode, base_url, credential_ref, status, notes_ar) VALUES
  ('aip-meta', 'meta', 'Meta Model API', 'bearer',
   'https://api.meta.ai',
   'META_MODEL_API_KEY', 'active',
   'Muse Spark. متوافق مع OpenAI فيستخدم نفس المحوّل. نموذج تفكير: يستهلك توكنات استدلال داخلية ضمن حدّ الإخراج، فحدّ صغير قد يُنهي الميزانية قبل أي نصّ. تنبيه: مستوى contributor أرخص مقابل السماح بالتدريب على ما تُرسله.');
