/** Pure, deterministic trip accounting. No car sensors, network or UI dependencies. */
export type Fix = {
  latitude: number; longitude: number; timestamp: number;
  accuracy: number | null; speed: number | null; heading?: number | null;
};
export type Point = Pick<Fix, 'latitude' | 'longitude' | 'timestamp'> & { breakBefore: boolean };
export type Rates = { litresPer100Km: number | null; pricePerLitre: number | null };
export type Preferences = Rates & {
  nickname: string; timeZone: string; monthlyBudget: number | null;
  speedAlert: number | null; keepAwake: boolean; recordRoute: boolean; backgroundTracking: boolean;
  photoUri: string | null;
};
export const DEFAULT_PREFERENCES: Preferences = {
  nickname: 'My i20', litresPer100Km: null, pricePerLitre: null,
  timeZone: 'Europe/Copenhagen', monthlyBudget: null, speedAlert: null,
  keepAwake: true, recordRoute: true, backgroundTracking: false, photoUri: null,
};
export type Slice = { metres: number; movingMs: number; trackedMs: number };
export type Trip = {
  id: string; title: string; startedAt: number; endedAt: number | null;
  status: 'recording' | 'paused' | 'finished'; pausedAt: number | null; pausedMs: number;
  rates: Rates; timeZone: string; recordRoute: boolean;
  metres: number; movingMs: number; trackedMs: number; maxSpeedKmh: number;
  lastFix: Fix | null; speedKmh: number | null; gaps: number; rejected: number;
  route: Point[]; slices: Record<string, Slice>;
};
export type FuelEntry = {
  id: string; timestamp: number; litres: number; pricePerLitre: number;
  odometerKm: number | null; fullTank: boolean;
};
export type Parking = { latitude: number; longitude: number; timestamp: number };
export type Totals = Slice & { litres: number; cost: number; unpricedMetres: number; trips: number };
export const MAX_ACCURACY_M = 35;
export const MAX_GAP_MS = 30_000;
export const STALE_MS = 10_000;
export const MAX_SPEED_KMH = 250;
const EMPTY_SLICE = (): Slice => ({ metres: 0, movingMs: 0, trackedMs: 0 });
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
export function parsePositive(text: string, min: number, max: number): number | null {
  const clean = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const value = Number(clean);
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}
export function validRates(r: Rates): boolean {
  return finite(r.litresPer100Km) && r.litresPer100Km > 0 && r.litresPer100Km <= 50
    && finite(r.pricePerLitre) && r.pricePerLitre > 0 && r.pricePerLitre <= 100;
}
export function estimate(metres: number, rates: Rates): { litres: number; cost: number } | null {
  if (!validRates(rates) || !finite(metres) || metres < 0) return null;
  const litres = metres / 100_000 * rates.litresPer100Km!;
  return { litres, cost: litres * rates.pricePerLitre! };
}
export function dayKey(timestamp: number, timeZone = 'Europe/Copenhagen'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(timestamp));
  return ['year', 'month', 'day'].map(k => parts.find(p => p.type === k)!.value).join('-');
}
export function monthKey(timestamp: number, timeZone = 'Europe/Copenhagen'): string {
  return dayKey(timestamp, timeZone).slice(0, 7);
}
export function distanceMetres(a: Pick<Fix, 'latitude' | 'longitude'>, b: Pick<Fix, 'latitude' | 'longitude'>): number {
  const r = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * r;
  const dLon = (b.longitude - a.longitude) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function validFix(f: Fix): boolean {
  return finite(f.latitude) && Math.abs(f.latitude) <= 90
    && finite(f.longitude) && Math.abs(f.longitude) <= 180
    && finite(f.timestamp) && f.timestamp > 0
    && finite(f.accuracy) && f.accuracy >= 0 && f.accuracy <= MAX_ACCURACY_M;
}
export function nativeSpeed(f: Fix): number | null {
  return finite(f.speed) && f.speed >= 0 && f.speed * 3.6 <= MAX_SPEED_KMH
    ? (f.speed < 0.8 ? 0 : f.speed * 3.6) : null;
}
export function freshSpeed(fix: Fix | null, speed: number | null, now: number): number | null {
  if (!fix || !validFix(fix) || now - fix.timestamp > STALE_MS || now < fix.timestamp - 2000) return null;
  return speed;
}
export function newTrip(id: string, timestamp: number, prefs: Preferences): Trip {
  return {
    id, title: 'Untitled drive', startedAt: timestamp, endedAt: null,
    status: 'recording', pausedAt: null, pausedMs: 0,
    rates: { litresPer100Km: prefs.litresPer100Km, pricePerLitre: prefs.pricePerLitre },
    timeZone: prefs.timeZone, recordRoute: prefs.recordRoute,
    metres: 0, movingMs: 0, trackedMs: 0, maxSpeedKmh: 0, lastFix: null,
    speedKmh: null, gaps: 0, rejected: 0, route: [], slices: {},
  };
}
/** Split an observed segment at local midnight, including DST and month boundaries. */
export function allocate(slices: Record<string, Slice>, from: number, to: number, metres: number, movingMs: number, zone: string): Record<string, Slice> {
  if (to <= from) return slices;
  const result = { ...slices };
  let cursor = from;
  while (cursor < to) {
    const key = dayKey(cursor, zone);
    let boundary = to;
    if (dayKey(to - 1, zone) !== key) {
      let lo = cursor + 1, hi = to;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (dayKey(mid, zone) === key) lo = mid + 1;
        else hi = mid;
      }
      boundary = lo;
    }
    const fraction = (boundary - cursor) / (to - from);
    const prev = result[key] ?? EMPTY_SLICE();
    result[key] = {
      metres: prev.metres + metres * fraction,
      movingMs: prev.movingMs + movingMs * fraction,
      trackedMs: prev.trackedMs + boundary - cursor,
    };
    cursor = boundary;
  }
  return result;
}
function appendRoute(trip: Trip, fix: Fix, broken: boolean): Point[] {
  if (!trip.recordRoute) return [];
  const previous = trip.route.at(-1);
  if (!broken && previous && distanceMetres(previous, fix) < 15 && fix.timestamp - previous.timestamp < 10_000) return trip.route;
  let route = [...trip.route, { latitude: fix.latitude, longitude: fix.longitude, timestamp: fix.timestamp, breakBefore: broken }];
  // Bounded on-device route storage. Preserve gaps when reducing older detail.
  if (route.length > 2048) {
    const reduced: Point[] = [route[0]];
    for (let i = 2; i < route.length - 1; i += 2) {
      reduced.push({ ...route[i], breakBefore: route[i].breakBefore || route[i - 1].breakBefore });
    }
    reduced.push({ ...route[route.length - 1], breakBefore: route.at(-1)!.breakBefore || route.at(-2)!.breakBefore });
    route = reduced;
  }
  return route;
}
export function ingest(trip: Trip, fix: Fix): Trip {
  if (trip.status !== 'recording' || fix.timestamp < trip.startedAt || (trip.lastFix && fix.timestamp <= trip.lastFix.timestamp)) return trip;
  if (!validFix(fix)) return { ...trip, rejected: trip.rejected + 1, speedKmh: null };
  const previous = trip.lastFix;
  const dt = previous ? fix.timestamp - previous.timestamp : 0;
  const gap = previous !== null && dt > MAX_GAP_MS;
  const speed = nativeSpeed(fix);
  if (!previous || gap) return {
    ...trip, lastFix: fix, speedKmh: speed, gaps: trip.gaps + (gap ? 1 : 0),
    route: appendRoute(trip, fix, true),
    maxSpeedKmh: Math.max(trip.maxSpeedKmh, speed ?? 0),
  };
  const measured = distanceMetres(previous, fix);
  const implied = measured / dt * 3600;
  if (implied > MAX_SPEED_KMH) return { ...trip, rejected: trip.rejected + 1, speedKmh: null };
  const jitter = measured < Math.max(2, Math.min(8, (fix.accuracy! + previous.accuracy!) * 0.25));
  const stationary = speed === 0 || (speed === null && jitter);
  const metres = stationary ? 0 : measured;
  const displayedSpeed = stationary ? 0 : (speed ?? implied);
  const movingMs = displayedSpeed >= 3 ? dt : 0;
  return {
    ...trip, metres: trip.metres + metres, movingMs: trip.movingMs + movingMs,
    trackedMs: trip.trackedMs + dt, lastFix: fix, speedKmh: displayedSpeed,
    maxSpeedKmh: Math.max(trip.maxSpeedKmh, displayedSpeed),
    route: metres > 0 ? appendRoute(trip, fix, false) : trip.route,
    slices: allocate(trip.slices, previous.timestamp, fix.timestamp, metres, movingMs, trip.timeZone),
  };
}
export function pauseTrip(t: Trip, now: number): Trip {
  return t.status !== 'recording' ? t : { ...t, status: 'paused', pausedAt: now, lastFix: null, speedKmh: null };
}
export function resumeTrip(t: Trip, now: number): Trip {
  return t.status !== 'paused' ? t : {
    ...t, status: 'recording', pausedAt: null,
    pausedMs: t.pausedMs + Math.max(0, now - (t.pausedAt ?? now)), lastFix: null, speedKmh: null,
  };
}
export function finishTrip(t: Trip, now: number): Trip {
  if (t.status === 'finished') return t;
  const resumed = t.status === 'paused' ? resumeTrip(t, now) : t;
  return { ...resumed, status: 'finished', endedAt: Math.max(now, t.startedAt), speedKmh: null };
}
export function elapsedMs(t: Trip, now: number): number {
  return Math.max(0, (t.endedAt ?? t.pausedAt ?? now) - t.startedAt - t.pausedMs);
}
export function totals(trips: Trip[], period: string): Totals {
  const sum: Totals = { ...EMPTY_SLICE(), litres: 0, cost: 0, unpricedMetres: 0, trips: 0 };
  for (const trip of trips) {
    let included = false;
    for (const [day, slice] of Object.entries(trip.slices)) {
      if (!day.startsWith(period)) continue;
      included = true;
      sum.metres += slice.metres; sum.movingMs += slice.movingMs; sum.trackedMs += slice.trackedMs;
      const e = estimate(slice.metres, trip.rates);
      if (e) { sum.litres += e.litres; sum.cost += e.cost; }
      else sum.unpricedMetres += slice.metres;
    }
    if (included) sum.trips++;
  }
  return sum;
}
export function fuelSpend(entries: FuelEntry[], period: string, zone: string): number {
  return entries.filter(e => dayKey(e.timestamp, zone).startsWith(period))
    .reduce((sum, e) => sum + e.litres * e.pricePerLitre, 0);
}
/** Full-to-full calculation includes all partial fills between the two full tanks. */
export function calibratedConsumption(entries: FuelEntry[]): number | null {
  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
  const full = sorted.map((e, index) => ({ e, index })).filter(({ e }) => e.fullTank && e.odometerKm !== null);
  if (full.length < 2) return null;
  const a = full.at(-2)!, b = full.at(-1)!;
  const km = b.e.odometerKm! - a.e.odometerKm!;
  if (km <= 0) return null;
  const litres = sorted.slice(a.index + 1, b.index + 1).reduce((sum, e) => sum + e.litres, 0);
  const value = litres / km * 100;
  return value > 0 && value <= 50 ? value : null;
}
export function csv(trips: Trip[]): string {
  const cell = (v: unknown) => {
    const value = String(v ?? '');
    const safe = /^[\s]*[=+@-]/.test(value) ? "'" + value : value;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  const header = ['Trip', 'Start ISO', 'End ISO', 'Distance km', 'Fuel estimate L', 'Fuel estimate DKK', 'L/100km setting', 'DKK/L setting', 'GPS gaps'];
  const rows = trips.map(t => {
    const e = estimate(t.metres, t.rates);
    return [t.title, new Date(t.startedAt).toISOString(), t.endedAt ? new Date(t.endedAt).toISOString() : '',
      (t.metres / 1000).toFixed(3), e?.litres.toFixed(3), e?.cost.toFixed(2), t.rates.litresPer100Km, t.rates.pricePerLitre, t.gaps];
  });
  return '\uFEFF' + [header, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
}
