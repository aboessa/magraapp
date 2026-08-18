import { describe, it, expect } from 'vitest';
import { polygonArea, containsPoint, hitRegionAt, validateRegions, isValidPolygon, type Region } from './coloringPolygon';

describe('coloringPolygon — matches Flutter runtime (coloring_regions.dart)', () => {
  it('rectangle area', () => {
    const rect: [number, number][] = [[0.2,0.3],[0.8,0.3],[0.8,0.7],[0.2,0.7]];
    expect(polygonArea(rect)).toBeCloseTo(0.24, 5);
    expect(containsPoint(rect, [0.5,0.5])).toBe(true);
    expect(containsPoint(rect, [0.1,0.1])).toBe(false);
  });

  it('triangle', () => {
    const tri: [number, number][] = [[0,0],[1,0],[0.5,1]];
    expect(polygonArea(tri)).toBeCloseTo(0.5, 5);
    expect(containsPoint(tri, [0.5,0.5])).toBe(true);
    expect(containsPoint(tri, [0.9,0.9])).toBe(false);
  });

  it('irregular pentagon', () => {
    const pent: [number, number][] = [[0.5,0.1],[0.9,0.4],[0.75,0.9],[0.25,0.9],[0.1,0.4]];
    expect(polygonArea(pent) > 0.3 && polygonArea(pent) < 0.6).toBe(true);
    expect(containsPoint(pent, [0.5,0.5])).toBe(true);
    expect(containsPoint(pent, [0.05,0.05])).toBe(false);
  });

  it('paint order: last region is topmost', () => {
    const regs: Region[] = [
      { id: 'a', polygon: [[0.1,0.1],[0.9,0.1],[0.9,0.9],[0.1,0.9]] },
      { id: 'b', polygon: [[0.3,0.3],[0.7,0.3],[0.7,0.7],[0.3,0.7]] },
    ];
    expect(hitRegionAt(regs, [0.5,0.5])).toBe('b');
    expect(hitRegionAt(regs, [0.15,0.15])).toBe('a');
    expect(hitRegionAt(regs, [0.05,0.05])).toBe(null);
  });

  it('validation: duplicate id, <3 points, oob, tiny area', () => {
    const bad: Region[] = [
      { id: 'dup', polygon: [[0.2,0.2],[0.8,0.2],[0.5,0.8]] },
      { id: 'dup', polygon: [[0.2,0.2],[0.8,0.2],[0.5,0.8]] },
      { id: 'tiny', polygon: [[0.5,0.5],[0.5001,0.5],[0.5,0.5001]] },
      { id: '', polygon: [[0.2,0.2],[0.8,0.2],[0.5,0.8]] },
      { id: 'oob', polygon: [[-0.1,0.5],[1.2,0.5],[0.5,0.8]] },
    ];
    const errs = validateRegions(bad);
    expect(errs.some(e => e.message.includes('duplicate'))).toBe(true);
    expect(errs.some(e => e.message.includes('area too small'))).toBe(true);
    expect(errs.some(e => e.message.includes('non-empty'))).toBe(true);
    expect(errs.some(e => e.message.includes('out of bounds'))).toBe(true);
  });

  it('isValidPolygon', () => {
    expect(isValidPolygon([[0.2,0.2],[0.8,0.2],[0.5,0.8]])).toBe(true);
    expect(isValidPolygon([[0.5,0.5]])).toBe(false);
    expect(isValidPolygon([[1.2,0.5],[0.5,0.5],[0.5,0.8]])).toBe(false);
  });
});
