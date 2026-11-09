# Physical-device acceptance checklist

Run on the S25 Ultra; these checks must not be described as passed until observed on that device.

1. Install the standalone ARM64 APK alongside the old dev app. Close Metro, unplug USB, disable Wi-Fi/mobile data, force-stop then cold-launch. Home artwork, fonts, settings and history must render.
2. Start with Location denied. Starting a trip must give an actionable permission message, not create fabricated readings. Grant precise location and retry outdoors.
3. Set a realistic consumption figure and pump price. Start while parked, then let a passenger monitor a short drive. Compare GPS distance against a known route; do not rely on GPS speed instead of the dash.
4. Pause, move, resume: paused movement must not be included. Finish, relaunch and verify saved history/rates. Change the price and confirm old trip cost does not change.
5. Enable screen-off recording with Always allow location. Start a drive, play Spotify over the car stereo, lock the phone and verify the recording notification and saved distance. Test Samsung battery optimisation behaviour.
6. Test foreground-only mode: switching apps should pause with a notice. Force-stop an unfinished recording, relaunch, and verify recovery without an invented straight-line segment.
7. Weak GPS/tunnel: speed should become unknown after 10 seconds; gaps longer than 30 seconds are not bridged. Check the gap notice.
8. Fill-up log: two full tanks and intermediate partial receipts should calculate consumption correctly. Pump spending must remain separate from trip estimates.
9. Save parking, open Maps, export CSV (no coordinates), rename/delete a trip, select a personal photo, and confirm persistence after restart.
10. Verify portrait layout with enlarged system font and Android gesture navigation; no clipped controls or text behind system bars.

The app does not access engine/door telemetry through the stereo, offer autonomous driving controls, or supply a verified speed-limit feed.
