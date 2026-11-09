import { test } from "node:test";
import { strict as assert } from "node:assert";
import { parsePid, telemetryFromPid, formatValue } from "../src/vehicle/obd";

test("RPM response with whitespace and prompt", () => {
  assert.equal(parsePid("010C\r41 0C 1A F8\r>", "010C"), 1726);
});
test("headered ELM327 responses", () => {
  assert.equal(parsePid("7E8: 41 0D 28\r>", "010D"), 40);
});
test("coolant, voltage, load and intake", () => {
  assert.equal(parsePid("41 05 7F", "0105"), 87);
  assert.equal(parsePid("41 42 30 D4", "0142"), 12.5);
  assert.equal(parsePid("41 04 FF", "0104"), 100);
  assert.equal(parsePid("41 0F 46", "010F"), 30);
});
test("do not turn missing/error readings into good status", () => {
  assert.equal(parsePid("NO DATA", "010C"), undefined);
  assert.equal(parsePid("41 0C FF", "010C"), undefined);
  assert.equal(parsePid("41 0D FF", "010C"), undefined);
  assert.equal(formatValue(undefined, "rpm"), "—");
});
test("units and mapped telemetry", () => {
  assert.deepEqual(telemetryFromPid("41 0C 10 00", "010C"), { rpm: 1024 });
});
