/**
 * Conservative, offline GPS elevation accounting.
 * Phone altitude is normally WGS-84 ellipsoidal; use only differences, not an MSL claim.
 * Never infer accelerator position, fuel-cut, engine braking, or current fuel flow.
 */
export type HeightFix = {
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  timestamp: number;
};
export type ElevationAnchor = {
  altitudeM: number; accuracyM: number; atMetres: number; timestamp: number;
};
export type ElevationStats = {
  ascentM: number; descentM: number;
  lastAltitudeM: number | null; lastAccuracyM: number | null;
  smoothedM?: number | null;
  coveredMetres: number; samples: number; rejected: number;
  anchor: ElevationAnchor | null;
};
export type ElevationUpdate = { stats: ElevationStats; ascentDelta: number; descentDelta: number };
export const EMPTY_ELEVATION = (): ElevationStats => ({
  ascentM: 0, descentM: 0, lastAltitudeM: null, lastAccuracyM: null, smoothedM: null,
  coveredMetres: 0, samples: 0, rejected: 0, anchor: null,
});
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
export function usableAltitude(fix: HeightFix): boolean {
  return finite(fix.altitude) && fix.altitude >= -500 && fix.altitude <= 9000
    && finite(fix.altitudeAccuracy) && fix.altitudeAccuracy >= 0 && fix.altitudeAccuracy <= 12;
}
/**
 * Require movement, comparable vertical accuracy, and a plausible road gradient.
 * The anchor is intentionally retained through small noisy variations, so a
 * sustained climb can accumulate beyond the sensor uncertainty threshold.
 */
export function observeElevation(previous: ElevationStats | undefined, fix: HeightFix,
  totalMetres: number, movingMetres: number, reset = false): ElevationUpdate {
  const p = previous ?? EMPTY_ELEVATION();
  const display = finite(fix.altitude) && fix.altitude >= -500 && fix.altitude <= 9000
    ? fix.altitude : null;
  const accuracy = finite(fix.altitudeAccuracy) && fix.altitudeAccuracy >= 0
    ? fix.altitudeAccuracy : null;
  const trusted = usableAltitude(fix);
  // A low-pass altitude avoids turning oscillating GPS noise into many small hills.
  const smoothed = trusted ? (finite(p.smoothedM)
    ? p.smoothedM * 0.5 + fix.altitude! * 0.5 : fix.altitude!) : null;
  const base: ElevationStats = {
    ...p, lastAltitudeM: smoothed ?? display, lastAccuracyM: accuracy, smoothedM: smoothed,
  };
  if (!trusted || !finite(totalMetres) || !finite(movingMetres)) {
    return { stats: { ...base, anchor: null, rejected: p.rejected + 1 }, ascentDelta: 0, descentDelta: 0 };
  }
  const anchor = { altitudeM: smoothed!, accuracyM: fix.altitudeAccuracy!,
    atMetres: totalMetres, timestamp: fix.timestamp };
  if (reset || !p.anchor) {
    return { stats: { ...base, anchor, samples: p.samples + 1 }, ascentDelta: 0, descentDelta: 0 };
  }
  const travelled = totalMetres - p.anchor.atMetres;
  const age = fix.timestamp - p.anchor.timestamp;
  // A gap, paused trip or stopped vehicle cannot safely establish a slope.
  if (age > 120000 || travelled > 1500 || age <= 0) {
    return { stats: { ...base, anchor, samples: p.samples + 1 }, ascentDelta: 0, descentDelta: 0 };
  }
  if (movingMetres <= 2 || travelled < 40 || age < 5000) {
    return { stats: { ...base, samples: p.samples + 1 }, ascentDelta: 0, descentDelta: 0 };
  }
  const difference = smoothed! - p.anchor.altitudeM;
  const threshold = Math.max(4.5, 1.5 * Math.hypot(fix.altitudeAccuracy!, p.anchor.accuracyM));
  if (Math.abs(difference) > Math.max(6, travelled * 0.15)) {
    return { stats: { ...base, rejected: p.rejected + 1 }, ascentDelta: 0, descentDelta: 0 };
  }
  // Mark coverage only for trusted moving measurements. Never mark GPS gaps.
  const coveredMetres = p.coveredMetres + Math.max(0, movingMetres);
  if (Math.abs(difference) < threshold) {
    return { stats: { ...base, coveredMetres, samples: p.samples + 1 }, ascentDelta: 0, descentDelta: 0 };
  }
  const ascentDelta = Math.max(0, difference);
  const descentDelta = Math.max(0, -difference);
  return {
    stats: { ...base, ascentM: p.ascentM + ascentDelta, descentM: p.descentM + descentDelta,
      coveredMetres, anchor, samples: p.samples + 1 },
    ascentDelta, descentDelta,
  };
}
export type TerrainInputs = {
  litresPer100Km: number | null; pricePerLitre: number | null;
  massKg?: number; fuelType?: 'petrol' | 'diesel'; terrainMode?: boolean;
};
export type TerrainEstimate = {
  litres: number; cost: number; baselineLitres: number; baselineCost: number;
  correctionLitres: number; correctionCost: number; coverage: number;
  illustrativeLowCost: number; illustrativeHighCost: number;
};
const GRAVITY = 9.80665;
// Typical lower heating values in J/L, approx. ACEA petrol 33.7 and diesel 36.9 MJ/L.
export function terrainEstimate(metres: number, rates: TerrainInputs,
  elevation?: Pick<ElevationStats, 'ascentM' | 'descentM' | 'coveredMetres'>): TerrainEstimate | null {
  if (!finite(metres) || metres < 0
    || !finite(rates.litresPer100Km) || rates.litresPer100Km <= 0 || rates.litresPer100Km > 50
    || !finite(rates.pricePerLitre) || rates.pricePerLitre <= 0 || rates.pricePerLitre > 100) return null;
  const baselineLitres = metres / 100000 * rates.litresPer100Km;
  const baselineCost = baselineLitres * rates.pricePerLitre;
  const mass = finite(rates.massKg) && rates.massKg >= 800 && rates.massKg <= 2500 ? rates.massKg : 1150;
  const energyPerLitre = rates.fuelType === 'diesel' ? 36900000 : 33700000;
  // A deliberately modest correction to the user's already calibrated consumption.
  // Engine efficiency and overrun fuel cut are UNKNOWN without ECU telemetry.
  const gravitationalLitres = mass * GRAVITY / (energyPerLitre * 0.25);
  const up = Math.max(0, finite(elevation?.ascentM) ? elevation!.ascentM : 0);
  const down = Math.max(0, finite(elevation?.descentM) ? elevation!.descentM : 0);
  const coverage = metres > 0 ? Math.min(1, Math.max(0, (elevation?.coveredMetres ?? 0) / metres)) : 0;
  const apply = rates.terrainMode === true && coverage >= 0.15 && metres >= 40;
  const uphill = apply ? Math.min(baselineLitres * 0.45, up * gravitationalLitres * 0.6) : 0;
  const downhill = apply ? Math.min(baselineLitres * 0.15, down * gravitationalLitres * 0.18) : 0;
  const litres = Math.max(baselineLitres * 0.85, baselineLitres + uphill - downhill);
  const correctionLitres = litres - baselineLitres;
  return {
    litres, cost: litres * rates.pricePerLitre,
    baselineLitres, baselineCost, correctionLitres,
    correctionCost: correctionLitres * rates.pricePerLitre,
    coverage,
    // Illustrative sensitivity, NOT a statistical confidence interval or fuel guarantee.
    illustrativeLowCost: litres * rates.pricePerLitre * 0.70,
    illustrativeHighCost: litres * rates.pricePerLitre * 1.30,
  };
}
