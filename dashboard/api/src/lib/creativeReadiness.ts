/**
 * Server-derived readiness for Creative Studio items.
 * Gates: runtime, assets, thumbnail, localization (AR/EN/FR), audio if required, objective valid, reviews approved, validation pass.
 * No manual Ready=true.
 */

export type ReadinessGate = 'runtime'|'assets'|'thumbnail'|'localization_ar'|'localization_en'|'localization_fr'|'audio'|'objective'|'reviews'|'validation';
export interface ReadinessInput {
  id: string;
  type: string;
  hasRuntime: boolean;
  hasAssets: boolean;
  hasThumbnail: boolean;
  hasAR: boolean;
  hasEN: boolean;
  hasFR: boolean;
  enRequiresReauthor?: boolean;
  frRequiresReauthor?: boolean;
  audioRequired: boolean;
  hasAudio: boolean;
  hasObjective: boolean;
  objectiveValid?: boolean;
  reviews: { type:string; status:string }[];
  validationPassed: boolean;
}
export interface ReadinessResult { ready: boolean; blocked: boolean; reasons: string[]; gates: Record<ReadinessGate, boolean> }

export function evaluateCreativeReadiness(input: ReadinessInput): ReadinessResult {
  const gates: Record<ReadinessGate, boolean> = {
    runtime: input.hasRuntime,
    assets: input.hasAssets,
    thumbnail: input.hasThumbnail,
    localization_ar: input.hasAR,
    localization_en: input.enRequiresReauthor ? true : input.hasEN,
    localization_fr: input.frRequiresReauthor ? true : input.hasFR,
    audio: !input.audioRequired || input.hasAudio,
    objective: !input.hasObjective || (input.objectiveValid ?? false),
    reviews: input.reviews.length===0 || input.reviews.every(r=> r.status==='approved'),
    validation: input.validationPassed,
  };
  const failed = (Object.entries(gates) as [ReadinessGate, boolean][]).filter(([,v])=> !v).map(([k])=> k);
  const reasons: string[] = [];
  if(!gates.runtime) reasons.push('Runtime not supported');
  if(!gates.assets) reasons.push('Missing assets');
  if(!gates.thumbnail) reasons.push('Missing thumbnail');
  if(!gates.localization_ar) reasons.push('AR localization missing');
  if(!gates.localization_en) reasons.push('EN localization missing');
  if(!gates.localization_fr) reasons.push('FR localization missing');
  if(!gates.audio) reasons.push('AR narration missing');
  if(!gates.reviews) reasons.push('Review pending: ' + input.reviews.filter(r=>r.status!=='approved').map(r=>r.type).join(', '));
  if(!gates.validation) reasons.push('Validation failed');
  return { ready: failed.length===0, blocked: failed.length>0, reasons, gates };
}
