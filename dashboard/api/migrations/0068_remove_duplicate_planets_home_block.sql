-- The original `block-worlds` orbit remains the canonical planets entry.
-- `block-planets` was added later by the resolved-home seed and duplicated it.
UPDATE home_experience_blocks
SET is_active = 0,
    updated_at = datetime('now')
WHERE id = 'block-planets'
  AND block_type = 'planet_orbit'
  AND title_ar = 'استكشف الكواكب';
