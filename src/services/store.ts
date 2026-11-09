import { useSyncExternalStore } from 'react';
import * as DB from './database';
import { DEFAULT_PREFERENCES, ingest, newTrip, pauseTrip, resumeTrip, finishTrip, validFix, type Fix, type Trip, type Preferences, type FuelEntry, type Parking } from '../core/trips';
export type Store = {
  loaded: boolean; error: string | null; prefs: Preferences; active: Trip | null;
  trips: Trip[]; fuel: FuelEntry[]; parking: Parking | null;
};
let current: Store = { loaded: false, error: null, prefs: { ...DEFAULT_PREFERENCES }, active: null, trips: [], fuel: [], parking: null };
const listeners = new Set<() => void>();
let initPromise: Promise<void> | undefined;
let queue: Promise<unknown> = Promise.resolve();
function emit(next: Store) { current = next; listeners.forEach(fn => fn()); }
const serialize = (key: string, value: unknown): DB.Change => ({ key, value: value == null ? null : JSON.stringify(value) });
const id = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
export const getStore = () => current;
export function useStore() { return useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, getStore, getStore); }
export async function initialize(): Promise<void> {
  return initPromise ??= (async () => {
    try {
      const entries = await DB.readAll();
      const parse = <T,>(key: string, fallback: T): T => entries[key] ? JSON.parse(entries[key]) : fallback;
      const trips = Object.entries(entries).filter(([k]) => k.startsWith('trip:')).map(([, v]) => JSON.parse(v) as Trip).sort((a, b) => b.startedAt - a.startedAt);
      const fuel = Object.entries(entries).filter(([k]) => k.startsWith('fuel:')).map(([, v]) => JSON.parse(v) as FuelEntry).sort((a, b) => b.timestamp - a.timestamp);
      emit({ loaded: true, error: null, prefs: { ...DEFAULT_PREFERENCES, ...parse<Partial<Preferences>>('preferences', {}) }, active: parse('active', null), parking: parse('parking', null), trips, fuel });
    } catch (e) {
      emit({ ...current, loaded: true, error: 'Local storage could not be read. Existing data has not been overwritten. ' + String(e) });
      throw e;
    }
  })();
}
/** Serialise headless-task and UI writes. Publish state only after its transaction commits. */
async function mutate(fn: (state: Store) => { state: Store; changes: DB.Change[] }): Promise<void> {
  const work = queue.then(async () => {
    await initialize();
    const { state, changes } = fn(current);
    if (changes.length) await DB.commit(changes);
    emit(state);
  });
  queue = work.catch(() => undefined);
  try { await work; }
  catch (e) { emit({ ...current, error: 'Changes could not be saved: ' + String(e) }); throw e; }
}
export function reportError(message: string | null) { emit({ ...current, error: message }); }
export async function savePreferences(patch: Partial<Preferences>) {
  await mutate(s => {
    const prefs = { ...s.prefs, ...patch };
    return { state: { ...s, prefs }, changes: [serialize('preferences', prefs)] };
  });
}
export async function startTrip() {
  await mutate(s => {
    if (s.active) throw new Error('A trip is already open. Resume or finish it first.');
    const active = newTrip(id(), Date.now(), s.prefs);
    return { state: { ...s, active, error: null }, changes: [serialize('active', active)] };
  });
}
export async function recordFix(fix: Fix) {
  await mutate(s => {
    if (!s.active) return { state: s, changes: [] };
    const active = ingest(s.active, fix);
    return { state: { ...s, active }, changes: active === s.active ? [] : [serialize('active', active)] };
  });
}
export async function pause() {
  await mutate(s => {
    const active = s.active ? pauseTrip(s.active, Date.now()) : null;
    return { state: { ...s, active }, changes: [serialize('active', active)] };
  });
}
export async function resume() {
  await mutate(s => {
    if (!s.active) throw new Error('No saved trip to resume.');
    const active = resumeTrip(s.active, Date.now());
    return { state: { ...s, active }, changes: [serialize('active', active)] };
  });
}
export async function finish() {
  await mutate(s => {
    if (!s.active) return { state: s, changes: [] };
    const trip = finishTrip(s.active, Date.now());
    const last = s.active.lastFix;
    const parking = last && validFix(last) && Date.now() - last.timestamp < 30_000
      ? { latitude: last.latitude, longitude: last.longitude, timestamp: Date.now() } : s.parking;
    return { state: { ...s, active: null, trips: [trip, ...s.trips], parking },
      changes: [serialize('trip:' + trip.id, trip), serialize('active', null), serialize('parking', parking)] };
  });
}
export async function editTrip(tripId: string, title: string) {
  await mutate(s => {
    const trip = s.trips.find(t => t.id === tripId);
    if (!trip) throw new Error('Trip not found.');
    const updated = { ...trip, title: title.trim().slice(0, 80) || 'Untitled drive' };
    return { state: { ...s, trips: s.trips.map(t => t.id === tripId ? updated : t) }, changes: [serialize('trip:' + tripId, updated)] };
  });
}
export async function deleteTrip(tripId: string) {
  await mutate(s => ({ state: { ...s, trips: s.trips.filter(t => t.id !== tripId) }, changes: [serialize('trip:' + tripId, null)] }));
}
export async function addFuel(entry: Omit<FuelEntry, 'id' | 'timestamp'>) {
  if (!Number.isFinite(entry.litres) || entry.litres <= 0 || entry.litres > 150 || !Number.isFinite(entry.pricePerLitre) || entry.pricePerLitre <= 0 || entry.pricePerLitre > 100) throw new Error('Enter valid litres and price.');
  await mutate(s => {
    const previous = s.fuel.find(f => f.odometerKm !== null);
    if (entry.odometerKm !== null && (!Number.isFinite(entry.odometerKm) || entry.odometerKm < 0 || (previous?.odometerKm != null && entry.odometerKm < previous.odometerKm))) throw new Error('Odometer must not go backwards.');
    const fuel = { ...entry, id: id(), timestamp: Date.now() };
    return { state: { ...s, fuel: [fuel, ...s.fuel] }, changes: [serialize('fuel:' + fuel.id, fuel)] };
  });
}
export async function deleteFuel(entryId: string) {
  await mutate(s => ({ state: { ...s, fuel: s.fuel.filter(f => f.id !== entryId) }, changes: [serialize('fuel:' + entryId, null)] }));
}
export async function saveParking(parking: Parking) {
  await mutate(s => ({ state: { ...s, parking }, changes: [serialize('parking', parking)] }));
}
export async function eraseHistory() {
  await mutate(s => {
    if (s.active) throw new Error('Finish the active trip before clearing history.');
    return { state: { ...s, trips: [], fuel: [], parking: null }, changes: [...s.trips.map(t => serialize('trip:' + t.id, null)), ...s.fuel.map(f => serialize('fuel:' + f.id, null)), serialize('parking', null)] };
  });
}
