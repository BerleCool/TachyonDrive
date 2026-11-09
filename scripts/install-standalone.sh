#!/bin/sh
set -eu
APK="${1:-android/app/build/outputs/apk/release/app-release.apk}"
PACKAGE=net.gideonai.tachyondrive.standalone
command -v adb >/dev/null || { echo 'ADB is required only for this installation step.'; exit 1; }
[ -f "$APK" ] || { echo "APK not found: $APK"; exit 1; }
# Do not uninstall, erase app data, or guess between multiple connected devices.
adb get-state
adb install -r "$APK"
adb shell am force-stop "$PACKAGE"
adb shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1
echo 'Installed the bundled standalone app. Disconnect USB and close Metro to verify cold launch.'
