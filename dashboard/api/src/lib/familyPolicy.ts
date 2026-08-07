export type Plan = 'free' | 'family' | 'family_plus';
export type AgeTrack = 'preschool' | 'kids' | 'junior';

export const PLAN_LIMITS: Record<Plan, {
  children: number;
  devices: number;
  concurrentStreams: number;
  downloadDevices: number;
}> = {
  free: { children: 1, devices: 1, concurrentStreams: 1, downloadDevices: 0 },
  family: { children: 4, devices: 4, concurrentStreams: 2, downloadDevices: 2 },
  family_plus: { children: 4, devices: 8, concurrentStreams: 4, downloadDevices: 4 },
};

const PLAN_RANK: Record<Plan, number> = { free: 0, family: 1, family_plus: 2 };

export function isPlan(value: unknown): value is Plan {
  return value === 'free' || value === 'family' || value === 'family_plus';
}

export function planAllows(actual: Plan, required: Plan) {
  return PLAN_RANK[actual] >= PLAN_RANK[required];
}

export function deriveAgeTrack(birthMonth: number, birthYear: number, now = new Date()): AgeTrack | null {
  if (!Number.isInteger(birthMonth) || birthMonth < 1 || birthMonth > 12) return null;
  if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > now.getUTCFullYear()) return null;
  const currentMonth = now.getUTCMonth() + 1;
  const age = now.getUTCFullYear() - birthYear - (currentMonth < birthMonth ? 1 : 0);
  if (age >= 3 && age <= 5) return 'preschool';
  if (age >= 6 && age <= 8) return 'kids';
  if (age >= 9 && age <= 12) return 'junior';
  return null;
}

export function normalizeTracks(value: unknown): AgeTrack[] | null {
  if (!Array.isArray(value)) return null;
  const tracks = [...new Set(value)];
  if (!tracks.length || tracks.some((track) => track !== 'preschool' && track !== 'kids' && track !== 'junior')) return null;
  return tracks as AgeTrack[];
}

export function boundedInteger(value: unknown, minimum: number, maximum: number): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}
