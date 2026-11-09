# TACHYON / DRIVE

**Android-first Hyundai i20 companion** — Expo / React Native / TypeScript, dark charcoal + restrained orange.

## Status
First functional foundation on `forgewell-connector`. The home screen contains a rotatable original 3D **GB-generation-inspired** model with independently animated front/rear doors. It is a *preview*, not a licensed factory-accurate 2018 i20 3D asset. No remote unlocking, door actuation or ECU coding is implemented.

Real BLE diagnostics are adapter-dependent. The app defaults to DISCONNECTED; sample values appear only when **Demo mode** is explicitly enabled. The car's stock Bluetooth audio connection is independent of a separate BLE OBD-II adapter.

## Setup

Requires Node >=22.13, Android Studio / Android SDK, Java 17 and a physical Android phone.

```sh
npm install
npx expo install --fix
npm run typecheck
npm test
npx expo run:android
```

**Use an Expo Development Build**, not Expo Go: `react-native-ble-plx` needs native modules. Pair with a supported **Bluetooth Low Energy** OBD adapter (not a Bluetooth Classic-only ELM327). BLE GATT services/characteristics vary by adapter, so automatic discovery may still need device-specific adaptation.

## App
- Home: responsive handset-first layout, 3D viewer, rotatable view, visual four-door open/close animations, metrics in connected/demo states
- Data: real vehicle RPM/speed/coolant/voltage/load/intake readings when BLE service supports PIDs
- Modules: read-only, clearly marks advanced Hyundai BCM/ABS as NOT VERIFIED
- Settings: demo toggle, connection/disconnection, license info

## Safety boundaries
- No OBD Mode 04 (clear DTC), ECU writes, security access, immobilizer operations, or remote locks.
- **Opening a 3D door does not unlock or open a physical door.** Physical door-ajar state can be synchronized only after verified manufacturer-specific read-only BCM data is available.
- No fabricated odometer, fuel level, VIN, diagnostic scan, or vehicle-health status.
- Never use the app while driving. Have a passenger monitor live data.

## 2018 body-year caution
2018 was the mid-cycle facelift year, so a particular 2018 VIN may be pre-facelift or facelift. Confirm your exact appearance before we substitute a licensed accurate model.

See `assets/models/README.md` for free model research and attribution.

## Architecture
- `src/components/CarModel.tsx`: independent 3D geometry and animated hinge rigs.
- `src/components/CarStage.tsx`: orbit/door controls.
- `src/vehicle/obd.ts`: unit-tested read-only PID decoding.
- `src/vehicle/BleObdService.ts`: BLE GATT adapter discovery, sequential ELM327 commands, polling.
- `src/App.tsx`: mobile-first pages and connection state.

## Known limitations
- Model is a hand-built approximation until a verified, compatible, free 2018 i20 model is available.
- Bluetooth Classic OBD adapters are not supported by `react-native-ble-plx`.
- UI and tests require device-level QA; CI cannot verify GPU rendering or an actual vehicle connection.
