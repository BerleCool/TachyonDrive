import { useSyncExternalStore } from 'react';
import { AppState, Platform, PermissionsAndroid } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { distanceMetres, nativeSpeed, validFix, MAX_GAP_MS, MAX_SPEED_KMH, type Fix } from '../core/trips';
import * as Store from './store';
export const LOCATION_TASK = 'tachyon-drive-location-v2';
type GPSState = { mode: 'off' | 'preview' | 'foreground' | 'background'; fix: Fix | null; speed: number | null; message: string };
let state: GPSState = { mode: 'off', fix: null, speed: null, message: 'GPS is off' };
const listeners = new Set<() => void>();
let foreground: Location.LocationSubscription | null = null;
let busy = false;
function emit(patch: Partial<GPSState>) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); }
export const getGPS = () => state;
export function useGPS() { return useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, getGPS, getGPS); }
function asFix(location: Location.LocationObject): Fix {
  return { latitude: location.coords.latitude, longitude: location.coords.longitude, timestamp: location.timestamp,
    accuracy: location.coords.accuracy, speed: location.coords.speed, heading: location.coords.heading };
}
async function receive(location: Location.LocationObject) {
  const fix = asFix(location);
  const old = state.fix;
  if (old && fix.timestamp <= old.timestamp) return;
  let speed = validFix(fix) ? nativeSpeed(fix) : null;
  if (speed === null && validFix(fix) && old && validFix(old)) {
    const dt = fix.timestamp - old.timestamp;
    if (dt > 0 && dt <= MAX_GAP_MS) {
      const metres = distanceMetres(old, fix);
      const estimated = metres / dt * 3600;
      if (estimated <= MAX_SPEED_KMH) speed = metres < Math.max(2, Math.min(8, (old.accuracy! + fix.accuracy!) * .25)) ? 0 : estimated;
    }
  }
  emit({ fix, speed, message: validFix(fix) ? 'Phone GPS' : 'Weak GPS signal - move outdoors' });
  try { await Store.recordFix(fix); }
  catch { emit({ message: 'Recording could not be saved. Stop and check storage.' }); }
}
if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(LOCATION_TASK)) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
    if (error) { Store.reportError('Background GPS: ' + error.message); return; }
    await Store.initialize();
    if (Store.getStore().active?.status !== 'recording') return;
    for (const location of [...(data?.locations ?? [])].sort((a, b) => a.timestamp - b.timestamp)) await receive(location);
  });
}
async function permission() {
  if (Platform.OS !== 'web' && !(await Location.hasServicesEnabledAsync())) throw new Error('Turn on Location in your phone settings.');
  const result = await Location.requestForegroundPermissionsAsync();
  if (!result.granted) throw new Error('Location permission is needed for GPS speed and trips. Enable precise location in Settings.');
}
async function watch() {
  foreground?.remove();
  foreground = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 1 }, location => { void receive(location); });
}
async function startCapture() {
  const prefs = Store.getStore().prefs;
  if (prefs.backgroundTracking && Platform.OS !== 'web') {
    const permission = await Location.getBackgroundPermissionsAsync();
    if (!permission.granted) throw new Error('Screen-off recording needs Always allow location. Enable it in Garage, or turn screen-off recording off.');
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2,
      deferredUpdatesInterval: 1000, pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation, showsBackgroundLocationIndicator: true,
      foregroundService: { notificationTitle: 'Tachyon Drive is recording', notificationBody: 'GPS trip in progress. Open Tachyon Drive to pause or finish.', notificationColor: '#FF8735', killServiceOnDestroy: true },
    });
    emit({ mode: 'background', message: 'Screen-off recording enabled' });
  } else {
    await watch();
    emit({ mode: 'foreground', message: 'Keep the app open to record' });
  }
}
async function exclusive(work: () => Promise<void>) {
  if (busy) return;
  busy = true;
  try { await work(); } finally { busy = false; }
}
export async function previewGPS() {
  await exclusive(async () => {
    if (Store.getStore().active?.status === 'recording') return;
    await permission(); await watch(); emit({ mode: 'preview', message: 'Live GPS - not recording a trip' });
  });
}
export function stopPreview() {
  if (state.mode !== 'preview') return;
  foreground?.remove(); foreground = null; emit({ mode: 'off', fix: null, speed: null, message: 'GPS is off' });
}
async function stopCapture() {
  foreground?.remove(); foreground = null;
  if (Platform.OS !== 'web' && await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  emit({ mode: 'off', fix: null, speed: null, message: 'GPS is off' });
}
export async function beginDrive() {
  await exclusive(async () => {
    await permission(); stopPreview();
    await Store.startTrip();
    try { await startCapture(); }
    catch (error) { await Store.pause(); await stopCapture(); throw error; }
  });
}
export async function resumeDrive() {
  await exclusive(async () => {
    await permission(); await Store.resume();
    try { await startCapture(); }
    catch (error) { await Store.pause(); await stopCapture(); throw error; }
  });
}
export async function pauseDrive() { await exclusive(async () => { await Store.pause(); await stopCapture(); }); }
export async function finishDrive() { await exclusive(async () => { await Store.finish(); await stopCapture(); }); }
export async function enableBackground() {
  await permission();
  if (Platform.OS === 'web') throw new Error('Screen-off recording is available in the installed Android app, not the browser preview.');
  const result = await Location.requestBackgroundPermissionsAsync();
  if (!result.granted) throw new Error('Always allow location was not granted. Foreground recording is still available.');
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  await Store.savePreferences({ backgroundTracking: true });
}
export async function rememberParking() {
  await permission();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const location = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('No GPS fix yet. Move outdoors and try again.')), 15000); }),
    ]);
    const fix = asFix(location);
    if (!validFix(fix)) throw new Error('GPS accuracy is too low to save a reliable parking location.');
    await Store.saveParking({ latitude: fix.latitude, longitude: fix.longitude, timestamp: fix.timestamp });
  } finally { if (timeout) clearTimeout(timeout); }
}
export async function restoreRecording() {
  await Store.initialize();
  if (Store.getStore().active?.status !== 'recording') return;
  if (Platform.OS !== 'web' && await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    emit({ mode: 'background', message: 'Resumed background recording' });
  } else {
    await Store.pause();
    Store.reportError('Your unfinished trip was recovered and paused. Tap Resume when ready; no missing distance has been invented.');
  }
}
AppState.addEventListener('change', status => {
  if (status !== 'active' && state.mode === 'preview') stopPreview();
  if (status !== 'active' && state.mode === 'foreground') {
    void pauseDrive().then(() => Store.reportError('Trip paused because the app left the foreground. Enable screen-off recording in Garage to continue with the screen locked.')).catch(e => Store.reportError(String(e)));
  }
});
