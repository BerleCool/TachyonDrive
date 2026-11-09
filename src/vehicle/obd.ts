import type { Telemetry } from "../types";

/** ELM327 read-only PID parser. Never sends diagnostic clear/configuration commands. */
export type SupportedPid = "0104" | "0105" | "010C" | "010D" | "010F" | "0142";
export const READ_ONLY_PIDS: SupportedPid[] = ["010C", "010D", "0105", "0142", "0104", "010F"];

export function decodeElmHex(raw: string): string {
  // Strip ELM prompts, echoed commands, 7E8 headers and textual status.
  const lines = raw.toUpperCase().split(/[\r\n]+/);
  const payloads: string[] = [];
  for (const item of lines) {
    const line = item.replace(/^[0-9A-F]{3}:?\s*/, "").replace(/\s/g, "");
    if (/^(4[13])[0-9A-F]{2,}$/.test(line)) payloads.push(line);
  }
  // Some adapters return the whole response on one line.
  if (payloads.length) return payloads.join("");
  return raw.toUpperCase().replace(/[^0-9A-F]/g, "");
}

export function parsePid(raw: string, request: SupportedPid): number | undefined {
  if (/NO DATA|UNABLE TO CONNECT|STOPPED|ERROR/i.test(raw)) return undefined;
  const normalized = decodeElmHex(raw);
  const pid = request.slice(2);
  const marker = "41" + pid;
  const at = normalized.indexOf(marker);
  if (at === -1) return undefined;
  const data = normalized.slice(at + marker.length);
  if (data.length < 2) return undefined;
  const a = parseInt(data.slice(0, 2), 16);
  if (!Number.isFinite(a)) return undefined;
  if (request === "010C" || request === "0142") {
    if (data.length < 4) return undefined;
    const b = parseInt(data.slice(2, 4), 16);
    if (!Number.isFinite(b)) return undefined;
    return request === "010C" ? (a * 256 + b) / 4 : (a * 256 + b) / 1000;
  }
  if (request === "0104") return a * 100 / 255;
  if (request === "0105") return a - 40;
  if (request === "010F") return a - 40;
  return a; // 010D - vehicle speed (km/h)
}

export function telemetryFromPid(raw: string, pid: SupportedPid): Telemetry {
  const value = parsePid(raw, pid);
  if (value === undefined) return {};
  switch (pid) {
    case "010C": return { rpm: Math.round(value) };
    case "010D": return { speedKmh: value };
    case "0105": return { coolantC: value };
    case "0142": return { batteryV: Math.round(value * 10) / 10 };
    case "0104": return { engineLoadPct: Math.round(value) };
    case "010F": return { intakeC: value };
  }
}

export function formatValue(value: number | undefined, unit: string): string {
  return value === undefined ? "—" : String(value) + (unit ? " " + unit : "");
}
