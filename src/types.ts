export type Tab = "home" | "data" | "modules" | "settings";
export type DoorKey = "frontLeft" | "frontRight" | "rearLeft" | "rearRight";
export type DoorState = Record<DoorKey, boolean>;
export const CLOSED_DOORS: DoorState = {
  frontLeft: false, frontRight: false, rearLeft: false, rearRight: false,
};
export type Telemetry = {
  rpm?: number;
  speedKmh?: number;
  coolantC?: number;
  batteryV?: number;
  engineLoadPct?: number;
  intakeC?: number;
};
export type ConnectionStatus = "disconnected" | "scanning" | "connecting" | "connected" | "error";
export type FoundDevice = { id: string; name: string; rssi?: number };
export type ScanState = { status: ConnectionStatus; devices: FoundDevice[]; error?: string };
export const DEMO_TELEMETRY: Telemetry = {
  rpm: 812,
  speedKmh: 0,
  coolantC: 87,
  batteryV: 12.6,
  engineLoadPct: 18,
  intakeC: 32,
};
