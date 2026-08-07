-- Applied separately because Wrangler remote D1 migrations fail to parse
-- CREATE TRIGGER blocks with error 7500. Reference:
-- https://community.cloudflare.com/t/create-trigger-does-not-work-in-migrations/728030

CREATE TRIGGER IF NOT EXISTS children_profiles_limit_insert
BEFORE INSERT ON children_profiles
WHEN NEW.status = 'active'
BEGIN
  SELECT CASE
    WHEN (SELECT id FROM parents WHERE id = NEW.parent_id) IS NULL
      THEN RAISE(ABORT, 'parent_not_found')
    WHEN (
      SELECT COUNT(*) FROM children_profiles
      WHERE parent_id = NEW.parent_id AND status = 'active'
    ) >= (
      SELECT CASE WHEN plan = 'free' THEN 1 ELSE 4 END
      FROM parents WHERE id = NEW.parent_id
    )
      THEN RAISE(ABORT, 'child_profile_limit_reached')
  END;
END;

CREATE TRIGGER IF NOT EXISTS children_profiles_limit_update
BEFORE UPDATE OF parent_id, status ON children_profiles
WHEN NEW.status = 'active' AND (OLD.status <> 'active' OR OLD.parent_id <> NEW.parent_id)
BEGIN
  SELECT CASE
    WHEN (SELECT id FROM parents WHERE id = NEW.parent_id) IS NULL
      THEN RAISE(ABORT, 'parent_not_found')
    WHEN (
      SELECT COUNT(*) FROM children_profiles
      WHERE parent_id = NEW.parent_id AND status = 'active' AND id <> OLD.id
    ) >= (
      SELECT CASE WHEN plan = 'free' THEN 1 ELSE 4 END
      FROM parents WHERE id = NEW.parent_id
    )
      THEN RAISE(ABORT, 'child_profile_limit_reached')
  END;
END;
