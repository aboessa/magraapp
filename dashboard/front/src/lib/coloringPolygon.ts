/** Coloring polygon contract — mirrors app_main/lib/features/games/engine/coloring_regions.dart
 *
 *  Normalized 0..1 coordinates. Same winding (ray crossing) + area + preview
 *  assumptions so editor preview === runtime fill.
 */

export type Point = [number, number];
export type Region = { id: string; polygon: Point[]; label?: string };

export function polygonArea(poly: Point[]): number {
  if (poly.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

export function containsPoint(poly: Point[], p: Point): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect =
      (yi > p[1]) !== (yj > p[1]) &&
      p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Hit topmost region at point (SVG paint order: last = top). */
export function hitRegionAt(regions: Region[], p: Point): string | null {
  if (regions.length === 0) return null;
  const hasAny = regions.some((r) => r.polygon.length >= 3);
  if (!hasAny) return regions[0].id;
  for (let i = regions.length - 1; i >= 0; i--) {
    if (containsPoint(regions[i].polygon, p)) return regions[i].id;
  }
  return null;
}

export type ValidationError = { regionId: string; message: string };

export function validateRegions(regions: Region[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const seen = new Set<string>();
  for (const r of regions) {
    if (!r.id || !r.id.trim()) {
      errors.push({ regionId: r.id || '(empty)', message: 'region id must be non-empty' });
      continue;
    }
    if (seen.has(r.id)) {
      errors.push({ regionId: r.id, message: 'duplicate region id' });
    }
    seen.add(r.id);
    if (r.polygon.length < 3) {
      errors.push({ regionId: r.id, message: 'polygon needs ≥3 points' });
      continue;
    }
    for (const pt of r.polygon) {
      if (!Number.isFinite(pt[0]) || !Number.isFinite(pt[1]) || pt[0] < 0 || pt[0] > 1 || pt[1] < 0 || pt[1] > 1) {
        errors.push({ regionId: r.id, message: `point [${pt[0]},${pt[1]}] out of bounds 0..1` });
      }
    }
    const area = polygonArea(r.polygon);
    if (area < 0.0005) {
      errors.push({ regionId: r.id, message: `polygon area too small (${area.toExponential(2)}) — not tappable` });
    }
  }
  return errors;
}

export function isValidPolygon(poly: Point[]): boolean {
  return poly.length >= 3 && poly.every((p) => p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1) && polygonArea(poly) >= 0.0005;
}
