/// Multi-skill learning objectives.
///
/// ## The defect this fixes
///
/// `learning_objectives.skill_id` is a single column, so an objective could only
/// name one skill. Verified against local D1 before migration 0022:
///
/// ```
/// skill.motor.pincer_grip  -> writing   -- a motor objective filed under literacy
/// lang.letters.trace_form  -> writing   -- true, but it is also fine-motor work
/// SELECT count(*) FROM learning_objectives WHERE skill_id='fine_motor';  -- 0
/// ```
///
/// `fine_motor` had been registered by migration 0018 and then referenced by
/// nothing at all, because the objectives that needed it had already spent their
/// one slot on `writing`.
///
/// ## The model
///
/// `skill_id` is retained and now means **the primary skill**. It is still the
/// column every existing consumer reads (`adminCatalogue` objective counts,
/// `adminMastery` filters, the CMS objective form), so none of them changed.
///
/// `learning_objective_skills` carries the primary *and* the secondaries, so a
/// caller wanting the full picture reads one table. A partial unique index
/// guarantees one primary per objective; [objectiveSkillWrites] derives that row
/// from the primary the caller supplied, so the table and the column cannot
/// drift apart.

export type SkillRole = 'primary' | 'secondary';

export interface ObjectiveSkillRow {
  skill_id: string;
  role: SkillRole;
  name_ar?: string | null;
  category?: string | null;
}

export interface ObjectiveSkills {
  /// Mirrors `learning_objectives.skill_id`. Null when the objective has not
  /// been assigned a skill yet — a real state for 60 of the 121 seeded rows.
  primary: string | null;
  secondary: string[];
}

/// Shape returned to API clients: the primary plus its secondaries, each with
/// the display fields the CMS needs, in a stable order.
export interface SerializedObjectiveSkills {
  primary_skill_id: string | null;
  secondary_skill_ids: string[];
  skills: Array<{ skill_id: string; role: SkillRole; name_ar: string | null; category: string | null }>;
}

const ROLES: readonly SkillRole[] = ['primary', 'secondary'];

export function isSkillRole(value: unknown): value is SkillRole {
  return typeof value === 'string' && ROLES.includes(value as SkillRole);
}

/// Collapses the join-table rows for one objective into a stable shape.
///
/// Defensive about duplicates and about more than one row claiming `primary`:
/// the index prevents that in D1, but this function is also used on payloads
/// that have not reached the database yet.
export function collapseObjectiveSkills(rows: readonly ObjectiveSkillRow[]): ObjectiveSkills {
  let primary: string | null = null;
  const secondary: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const id = typeof row.skill_id === 'string' ? row.skill_id.trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (row.role === 'primary' && primary === null) primary = id;
    else secondary.push(id);
  }

  secondary.sort();
  return { primary, secondary };
}

export function serializeObjectiveSkills(rows: readonly ObjectiveSkillRow[]): SerializedObjectiveSkills {
  const { primary, secondary } = collapseObjectiveSkills(rows);
  const byId = new Map(rows.map((row) => [row.skill_id, row]));
  const display = (id: string, role: SkillRole) => ({
    skill_id: id,
    role,
    name_ar: byId.get(id)?.name_ar ?? null,
    category: byId.get(id)?.category ?? null,
  });

  return {
    primary_skill_id: primary,
    secondary_skill_ids: secondary,
    // Primary first: the CMS renders this list directly and the primary is the
    // one that drives reporting.
    skills: [
      ...(primary ? [display(primary, 'primary')] : []),
      ...secondary.map((id) => display(id, 'secondary')),
    ],
  };
}

export interface ObjectiveSkillPayload {
  primary: string | null;
  secondary: string[];
}

/// Validates a caller-supplied skill assignment.
///
/// Rules, and why each exists:
///  - secondary must be an array of non-empty strings — the column is a FK.
///  - the primary may not repeat as a secondary; a skill relates to an objective
///    once, and the join table's primary key would reject it anyway. Silently
///    de-duplicating would make the API lie about what it stored.
///  - secondaries with no primary are rejected. A "supporting" skill with
///    nothing to support is a data-entry mistake, and it would produce an
///    objective invisible to every `skill_id` consumer while still claiming
///    skills.
export function parseObjectiveSkills(
  primaryRaw: unknown,
  secondaryRaw: unknown,
): { payload: ObjectiveSkillPayload } | { error: string } {
  const primary = primaryRaw === null || primaryRaw === undefined || primaryRaw === ''
    ? null
    : typeof primaryRaw === 'string' ? primaryRaw.trim() : null;
  if (primaryRaw !== null && primaryRaw !== undefined && primaryRaw !== '' && !primary) {
    return { error: 'skill_id must be a non-empty string or null' };
  }

  if (secondaryRaw === undefined || secondaryRaw === null) {
    return { payload: { primary, secondary: [] } };
  }
  if (!Array.isArray(secondaryRaw)) {
    return { error: 'secondary_skill_ids must be an array' };
  }

  const secondary: string[] = [];
  for (const entry of secondaryRaw) {
    if (typeof entry !== 'string' || !entry.trim()) {
      return { error: 'secondary_skill_ids must contain non-empty strings' };
    }
    const id = entry.trim();
    if (primary && id === primary) {
      return { error: `${id} is already the primary skill and cannot also be a secondary skill` };
    }
    if (secondary.includes(id)) {
      return { error: `${id} is listed twice in secondary_skill_ids` };
    }
    secondary.push(id);
  }

  if (!primary && secondary.length) {
    return { error: 'secondary_skill_ids require a primary skill_id' };
  }

  return { payload: { primary, secondary: secondary.sort() } };
}

/// The rows to write for one objective, primary first.
///
/// Callers delete the objective's existing rows and insert these, so the primary
/// is always rebuilt from `skill_id` and the two representations agree by
/// construction rather than by convention.
export function objectiveSkillWrites(payload: ObjectiveSkillPayload): Array<{ skill_id: string; role: SkillRole }> {
  return [
    ...(payload.primary ? [{ skill_id: payload.primary, role: 'primary' as SkillRole }] : []),
    ...payload.secondary.map((skill_id) => ({ skill_id, role: 'secondary' as SkillRole })),
  ];
}

/// Every distinct skill id referenced by a payload, for existence checking
/// before the write.
export function referencedSkillIds(payload: ObjectiveSkillPayload): string[] {
  return objectiveSkillWrites(payload).map((row) => row.skill_id);
}
