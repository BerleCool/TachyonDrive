# Tachyon Drive 0.3

A standalone, phone-powered driving companion for a **2018 Hyundai i20**. React Native + Expo SDK 58 + **NativeWind**, with a charcoal/orange mobile interface.

## What it actually does

- Animated GPS speedometer, focus display, optional visual speed threshold and keep-awake.
- Start, pause, resume and finish a trip; recover unfinished trips after restart.
- GPS distance, elapsed/moving time, average/max speed and optional offline route traces.
- Estimated fuel cost using your consumption and DKK/litre settings; daily and monthly totals.
- GPS elevation, filtered ascent/descent, experimental slope-aware fuel adjustment with editable vehicle mass/fuel type; offline, no Google API billing.
- Per-trip rate snapshots: changing today's price does not rewrite yesterday's costs.
- Separate fill-up receipts and actual pump spending; full-to-full consumption calibration.
- Saved parking location, CSV export without coordinates, personal car photo and local deletion controls.
- On-device SQLite storage; no account, backend, analytics or runtime asset downloads.

## No OBD adapter required

The app uses **phone GPS**, not diagnostic data from the stereo. Pair Bluetooth audio in Android as usual. Tachyon does not claim to read engine RPM, ECU faults, fuel level or door states from that connection, and does not take audio focus.

Costs are estimates: `distance km / 100 * litres per 100 km * DKK per litre`. Rates start unset. Enter your own measured consumption (L/100km or km/L) and pump price in Garage. Idling, driving style, inaccurate GPS and missing segments can change actual consumption. Actual fill-up spending is displayed separately, never added to trip estimates.

## Standalone install: no laptop after installation

The **Standalone Android and verification** workflow builds an ARM64 **release-variant APK**, with JavaScript, fonts and artwork embedded. Download the `TachyonDrive-standalone-arm64` artifact from a successful run. Install the APK on the S25 Ultra, then close Metro, unplug USB and cold-launch **Tachyon Drive**.

The standalone application ID is `net.gideonai.tachyondrive.standalone`; the development ID remains `net.gideonai.tachyondrive`. This deliberately installs alongside the previous development app without erasing its data or assuming signing keys match. The apps do not share history. Do not uninstall an existing app to work around a signature mismatch without exporting its data first.

CI's locally built personal APK uses the Expo-generated Android debug signing configuration in a **release build**. It has an embedded bundle and is not a Metro-dependent development client, but is not a production-signed Play Store release. Maintain a private stable signing key before distributing outside personal testing; never commit that key. EAS internal distribution can manage signing separately.

ADB installation (optional; used only for installation):

```sh
sh scripts/install-standalone.sh /path/to/TachyonDrive-standalone-arm64.apk
```

Or build locally with Node 22 and the Android SDK/JDK supported by Expo:

```sh
npm install
npm run assets                  # only needed if bundled artwork is missing; Python/Pillow
npm run typecheck
npm test
TACHYON_STANDALONE=1 npx expo prebuild --platform android
TACHYON_STANDALONE=1 npx expo run:android --variant release
```

Do not use `expo start` as the normal way to launch an installed standalone app. Metro is only a development tool.

## GPS and screen-off behaviour

Location is requested only when you enable GPS/start a drive/save parking. Use precise location. Foreground-only recording pauses when leaving the app. Enable **Garage > Screen-off recording** and grant **Allow all the time** to record while using Spotify or locking the screen. An Android foreground-service notification identifies ongoing tracking. Force-stop and device battery restrictions can stop tracking; recovery pauses an interrupted session rather than inventing missing distance.

Trips are started explicitly; pairing the stereo does **not** secretly start location tracking. Recording stops on Pause/Finish. Preview dial values never enter history. GPS speed is supplementary, not a replacement for the vehicle speedometer. Set up the app while parked.

## Vehicle visual

The inaccurate procedural 3D car has been removed. The offline home uses an actual **2018 i20 reference photograph**, credited to Vauxford under CC BY-SA 4.0, or a photo you choose. **The photo is not a 3D model.** On Android, tap **3D VIEW** to open the internet-hosted Sketchfab interactive viewer of the 2019 i20 Active (or switch to the alternative i20). Rotate and pinch zoom there; no model meshes are redistributed and doors are not rigged. See `assets/ATTRIBUTION.md`. No exact free, licensed, door-rigged 2018 mesh has been integrated. Physical door-state synchronisation is not available without an appropriate vehicle-data source.

## Architecture

- `src/core/trips.ts`: pure GPS filtering, cost estimates, local-day allocation, calibration and CSV escaping.
- `src/services/database.ts`: SQLite WAL with transactional writes; `.web.ts` uses browser storage for UI testing only.
- `src/services/store.ts`: serialised state changes; publish only after persistence succeeds.
- `src/services/location.ts`: foreground watcher, Android foreground-service/background task, recovery and permissions.
- `src/ui/instruments.tsx`: custom SVG speedometer and route/cost visualisations.
- `src/screens/`: Home, Drive, Trips and Garage, styled with NativeWind.

## Verification

CI checks TypeScript, deterministic accounting tests, retained OBD parser unit tests, Android JS export, browser interaction tests with actual screenshots, and the native release APK. It checks the APK contains `assets/index.android.bundle`. These are not equivalent to a real-car road test or S25 device validation. See `docs/DEVICE_QA.md` for the remaining physical-device checks.

The repository intentionally keeps the old pure OBD parser tests as regression coverage, but the new app neither imports a BLE transport nor requests Bluetooth scanning permissions.

## Altitude and physical fuel assumptions

The app records Expo GPS altitude and vertical accuracy, and filters hill changes before a **conservatively capped experimental** fuel correction; see `docs/ELEVATION.md`. It does NOT know gear, accelerator state, idling, fuel injection cut-off, or actual fuel-flow, and does not treat downhills as free petrol. No Google Maps API key or elevation web service is involved. The 3D Sketchfab viewer is online-only, while GPS trip tracking and the reference image remain offline-capable.
