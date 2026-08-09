/// Bounding boxes for the map regions `timeline_map` packs may name.
///
/// The pack names a region and an equirectangular projection but carries no bounding
/// box, so the box has to come from somewhere. It lives here on the server as well
/// as in `app_main/lib/features/games/engine/timeline_map_engine.dart` because both
/// need it for different reasons: the client to draw and hit-test, the server to
/// reject an event whose coordinates fall outside the map a child will be shown.
///
/// `test/mapRegions.test.mjs` and the Dart engine test are both driven by
/// `docs/games/fixtures/map_regions.json`, so the two copies cannot drift.
///
/// Deliberately not political: a bounding box is a viewport, and no borders are
/// drawn from this data.

export interface RegionBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export const WORLD_BOUNDS: RegionBounds = {
  minLat: -60,
  maxLat: 80,
  minLon: -180,
  maxLon: 180,
};

export const REGION_BOUNDS: Record<string, RegionBounds> = {
  middle_east_north_africa: { minLat: 10, maxLat: 42, minLon: -18, maxLon: 63 },
  arab_world: { minLat: 10, maxLat: 40, minLon: -18, maxLon: 60 },
  world: WORLD_BOUNDS,
};

export function boundsForRegion(region: string): RegionBounds {
  return REGION_BOUNDS[region] ?? WORLD_BOUNDS;
}
