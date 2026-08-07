-- A single last_event_at_ms watermark let an unrelated newer event (for example
-- progress.updated) permanently block identity or plan projection updates.
-- Each projected concern now carries its own monotonic watermark.
ALTER TABLE family_projection ADD COLUMN identity_event_at_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE family_projection ADD COLUMN plan_event_at_ms INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_family_projection_plan_watermark ON family_projection(plan_event_at_ms);
