# Standalone build verification - 2026-11-09

## Build identity

- Requested branch: `forgewell-connector`.
- Tested source commit: `96d7848bf8de143fc3a8cc9325dd900f2a819f15`.
- Follow-up commit containing the dependencies/artwork used in that build: `06c90132626e16d10752c82c91db29670ee47f80`.
- GitHub Actions run: https://github.com/BerleCool/TachyonDrive/actions/runs/42654274854
- Job: `verify-and-build` (`129288465449`).
- Run conclusion: **success**. This report does not claim a physical Android device was tested.

## Observed automated results

The job logs were inspected after the interrupted session was resumed.

- TypeScript: passed.
- Trip/accounting tests: **29 passed, 0 failed**.
- Retained OBD parser regression tests: **5 passed, 0 failed**. These do not mean that OBD hardware is required or used by the current app.
- Browser interaction tests: **3 passed**. They cover portrait/NativeWind layout and isolated instrument preview; preference persistence across reload; and simulated-browser geolocation with start/pause/resume/finish and persistent history.
- Android JavaScript export: passed.
- Native Android release-variant build: passed (`:app:assembleRelease`, ARM64).
- Embedded JavaScript verification in CI: passed.

The accounting coverage includes stationary GPS jitter, duplicate timestamps, implausible jumps, signal gaps, pause/resume, per-trip rate snapshots, Copenhagen midnight/month boundaries, DST, missing rates, full-to-full fuel calibration, CSV escaping and bounded route storage.

## Downloaded APK inspected independently

The `TachyonDrive-standalone-arm64` artifact (`13692246548`) was downloaded and opened after the build. Its archive digest matches GitHub's reported digest.

- Artifact ZIP SHA-256: `6ea1cb626b4e4f3ee383417ea7e19f0839504be93d6a389ba8afc6fd6acc0785`
- APK filename: `TachyonDrive-standalone-arm64.apk`
- APK size: **32,885,483 bytes**.
- APK SHA-256: `374d46f7d92d09bbd6ce248d0f38ecf4dce6bb2bbfa3b318cbc06838d6bb0eb5`
- The APK checksum also matches its packaged `.sha256` file.
- ZIP integrity check: passed.
- Embedded `assets/index.android.bundle`: present, **3,046,984 bytes**.
- Native libraries: `arm64-v8a`.
- Embedded `assets/app.config`: app version **0.2.0**, Android version code **2**, package **`net.gideonai.tachyondrive.standalone`**, backup disabled.

This is a self-contained release-variant build, not a Metro-served development client. It is a personal-testing APK using the signing setup described in README, not a production-signed Play Store distribution.

## Visual review

Home, Drive, Trips and Garage screenshots were inspected. They are browser-rendered screenshots of the app code, **not screenshots captured from the S25 Ultra** and not image-generated concept art. The speedometer screenshot uses the explicitly labeled instrument preview; its 90 km/h is not measured driving data. The car visual is a licensed reference photograph of a 2018 i20, **not a 3D model**.

## Still requires the user's physical device

- Install the standalone APK and cold-launch with the USB cable unplugged and Metro stopped.
- Verify precise GPS acquisition outdoors and compare with known route distance; phone GPS is supplementary to the car's instruments.
- Verify start/pause/resume/finish, persisted history and permission-denial recovery on the S25 Ultra.
- Verify screen-off recording after enabling the option and granting Always allow location; check Samsung battery restrictions.
- Verify Spotify playback continues while recording and that foreground-only mode pauses visibly when leaving the app.
- Verify force-stop/restart recovery and that missing distance is not invented.

No vehicle ECU access, actual fuel sensor readings, stock-stereo diagnostic access, physical door-state synchronization or exact free door-rigged 2018 i20 asset is claimed. Trip costs use manually supplied consumption and DKK/litre, not measured fuel flow. Pairing Bluetooth audio does not automatically start tracking.
