import { Buffer } from "buffer";
import { BleManager, Device, State, type Characteristic, type Subscription } from "react-native-ble-plx";
import { Platform, PermissionsAndroid } from "react-native";
import { READ_ONLY_PIDS, telemetryFromPid, type SupportedPid } from "./obd";
import type { ConnectionStatus, FoundDevice, Telemetry } from "../types";

// Standard Nordic UART service plus commonly used (not universal) FFE0 UART clones.
// Note: many low-cost ELM327 devices use Bluetooth Classic and will NOT work here.
const SUPPORTED_SERVICES = [
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
];
const NUS_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
const FFE1 = "0000ffe1-0000-1000-8000-00805f9b34fb";

export type ConnectionSnapshot = {
  status: ConnectionStatus;
  connectedName: string | null;
  telemetry: Telemetry;
  message: string;
};

type FoundListener = (devices: FoundDevice[]) => void;
type SnapshotListener = (state: ConnectionSnapshot) => void;

function normalizeId(value: string) { return value.toLowerCase(); }

/** Only these queries are ever allowed on an established adapter session. */
const ALLOWED_COMMANDS = new Set<string>([
  "ATZ", "ATE0", "ATL0", "ATS0", "ATH0", "ATSP0",
  ...READ_ONLY_PIDS,
]);

export class BleObdService {
  private manager: BleManager | undefined;
  private device: Device | undefined;
  private tx: Characteristic | undefined;
  private rx: Characteristic | undefined;
  private notification?: Subscription;
  private pollTimer?: ReturnType<typeof setTimeout>;
  private scanTimer?: ReturnType<typeof setTimeout>;
  private queue: string[] = [];
  private pending?: { resolve: (value: string) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };
  private latestBuffer = "";
  private busy = false;
  private generation = 0;
  private snapshot: ConnectionSnapshot = {
    status: "disconnected", connectedName: null,
    telemetry: {}, message: "No adapter connected",
  };
  private onSnapshot?: SnapshotListener;

  subscribe(listener: SnapshotListener) {
    this.onSnapshot = listener;
    listener({ ...this.snapshot });
    return () => { if (this.onSnapshot === listener) this.onSnapshot = undefined; };
  }

  private emit(patch: Partial<ConnectionSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.onSnapshot?.({ ...this.snapshot, telemetry: { ...this.snapshot.telemetry } });
  }

  private getManager() { return this.manager ?? (this.manager = new BleManager()); }

  private async ensurePermissions(): Promise<void> {
    if (Platform.OS !== "android") return;
    if (Number(Platform.Version) >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      if (Object.values(results).some(result => result !== PermissionsAndroid.RESULTS.GRANTED)) {
        throw new Error("Bluetooth Nearby Devices permission is required.");
      }
    } else {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new Error("Location permission is required for BLE scanning on this Android version.");
      }
    }
  }

  async scan(onDevices: FoundListener, timeoutMs = 9000): Promise<void> {
    const manager = this.getManager();
    await this.ensurePermissions();
    this.stopScan();
    if (await manager.state() !== State.PoweredOn) {
      throw new Error("Enable Bluetooth before scanning for an OBD-II adapter.");
    }
    const seen = new Map<string, FoundDevice>();
    this.emit({ status: "scanning", message: "Scanning for BLE adapters…" });
    manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        this.stopScan();
        this.emit({ status: "error", message: error.message });
        return;
      }
      if (!device || !device.name) return;
      seen.set(device.id, { id: device.id, name: device.name, rssi: device.rssi ?? undefined });
      onDevices([...seen.values()].sort((a, b) => (b.rssi ?? -150) - (a.rssi ?? -150)));
    });
    this.scanTimer = setTimeout(() => {
      this.stopScan();
      if (this.snapshot.status === "scanning") this.emit({ status: "disconnected", message: "Scan complete. Select your adapter." });
    }, timeoutMs);
  }

  stopScan() {
    this.manager?.stopDeviceScan();
    if (this.scanTimer) clearTimeout(this.scanTimer);
    this.scanTimer = undefined;
  }

  async connect(deviceId: string): Promise<void> {
    this.stopScan();
    await this.disconnect();
    const generation = ++this.generation;
    const manager = this.getManager();
    this.emit({ status: "connecting", message: "Connecting to BLE adapter…" });
    try {
      const device = await manager.connectToDevice(deviceId, { timeout: 12000 });
      this.device = await device.discoverAllServicesAndCharacteristics();
      if (generation !== this.generation) { await device.cancelConnection(); return; }
      await this.discoverSerial();
      this.notification = this.rx!.monitor((_error, characteristic) => {
        if (_error) { this.failPending(new Error(_error.message)); return; }
        if (!characteristic?.value) return;
        const chunk = Buffer.from(characteristic.value, "base64").toString("utf8");
        this.latestBuffer += chunk;
        if (this.latestBuffer.length > 16000) this.latestBuffer = this.latestBuffer.slice(-8000);
        if (this.pending && this.latestBuffer.includes(">")) {
          const response = this.latestBuffer.slice(0, this.latestBuffer.indexOf(">"));
          this.latestBuffer = this.latestBuffer.slice(this.latestBuffer.indexOf(">") + 1);
          const pending = this.pending;
          this.pending = undefined;
          clearTimeout(pending.timer);
          pending.resolve(response);
        }
      });
      for (const command of ["ATZ", "ATE0", "ATL0", "ATS0", "ATH0", "ATSP0"]) {
        await this.command(command, command === "ATZ" ? 5000 : 2000);
      }
      this.emit({ status: "connected", connectedName: device.name ?? "BLE OBD-II", message: "Read-only OBD session" });
      this.poll(generation);
    } catch (error) {
      await this.disconnect();
      this.emit({ status: "error", message: error instanceof Error ? error.message : "Connection failed" });
      throw error;
    }
  }

  private async discoverSerial() {
    if (!this.device) throw new Error("No adapter connected");
    const services = await this.device.services();
    for (const service of services) {
      if (!SUPPORTED_SERVICES.includes(normalizeId(service.uuid))) continue;
      const chars = await service.characteristics();
      const writable = chars.find(c =>
        (c.isWritableWithResponse || c.isWritableWithoutResponse)
        && [NUS_RX, FFE1].includes(normalizeId(c.uuid)));
      const notify = chars.find(c =>
        (c.isNotifiable || c.isIndicatable) && [NUS_TX, FFE1].includes(normalizeId(c.uuid)));
      if (writable && notify) {
        this.tx = writable;
        this.rx = notify;
        return;
      }
    }
    throw new Error("This adapter does not expose a supported BLE serial service (Nordic UART / FFE0). A Bluetooth Classic adapter requires a different transport.");
  }

  private failPending(error: Error) {
    if (!this.pending) return;
    const p = this.pending;
    this.pending = undefined;
    clearTimeout(p.timer);
    p.reject(error);
  }

  private async command(command: string, timeoutMs = 2400): Promise<string> {
    if (!ALLOWED_COMMANDS.has(command)) throw new Error("Blocked: unsupported or write-capable command");
    if (!this.tx || !this.device) throw new Error("No serial channel available");
    if (this.pending) throw new Error("Another OBD command is still pending");
    this.latestBuffer = "";
    const tx = this.tx;
    const answer = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => this.failPending(new Error("OBD request timeout")), timeoutMs);
      this.pending = { resolve, reject, timer };
    });
    try {
      const data = Buffer.from(command + "\r").toString("base64");
      if (tx.isWritableWithResponse) {
        await tx.writeWithResponse(data);
      } else {
        await tx.writeWithoutResponse(data);
      }
    } catch (error) {
      this.failPending(error instanceof Error ? error : new Error("BLE write failed"));
    }
    return answer;
  }

  private async poll(generation: number): Promise<void> {
    if (generation !== this.generation || !this.device) return;
    if (this.busy) return;
    this.busy = true;
    const next: Telemetry = {};
    try {
      for (const pid of READ_ONLY_PIDS) {
        if (generation !== this.generation) break;
        try {
          const raw = await this.command(pid);
          Object.assign(next, telemetryFromPid(raw, pid));
        } catch { /* Unsupported PIDs are omitted, never invented. */ }
      }
      if (generation === this.generation) {
        this.emit({ telemetry: next, message: "Live read-only data" });
      }
    } finally {
      this.busy = false;
      if (generation === this.generation) {
        this.pollTimer = setTimeout(() => { void this.poll(generation); }, 1500);
      }
    }
  }

  async disconnect(): Promise<void> {
    this.generation += 1;
    this.stopScan();
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = undefined;
    this.notification?.remove();
    this.notification = undefined;
    this.failPending(new Error("Disconnected"));
    const device = this.device;
    this.device = undefined;
    this.tx = undefined;
    this.rx = undefined;
    this.latestBuffer = "";
    this.busy = false;
    if (device) {
      try { await device.cancelConnection(); } catch { /* Already disconnected. */ }
    }
    this.emit({ status: "disconnected", connectedName: null, telemetry: {}, message: "No adapter connected" });
  }

  destroy(): void {
    void this.disconnect().finally(() => {
      this.manager?.destroy();
      this.manager = undefined;
    });
  }
}
