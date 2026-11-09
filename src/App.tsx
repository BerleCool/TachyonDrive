import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Pressable, ScrollView,
  StatusBar, StyleSheet, Switch, Text, View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { CarStage } from "./components/CarStage";
import { BleObdService, type ConnectionSnapshot } from "./vehicle/BleObdService";
import { C } from "./theme";
import { DEMO_TELEMETRY, type FoundDevice, type Tab, type Telemetry } from "./types";
import { formatValue } from "./vehicle/obd";

const INITIAL: ConnectionSnapshot = {
  status: "disconnected", connectedName: null, telemetry: {},
  message: "No OBD adapter connected",
};
const NAV: { id: Tab; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { id: "home", icon: "home-outline", label: "Home" },
  { id: "data", icon: "pulse-outline", label: "Live data" },
  { id: "modules", icon: "layers-outline", label: "Systems" },
  { id: "settings", icon: "options-outline", label: "Settings" },
];

function Icon({ name, size = 20, color = C.secondary }: {
  name: keyof typeof Ionicons.glyphMap; size?: number; color?: string;
}) { return <Ionicons name={name} size={size} color={color} />; }

function Brand() {
  return <View style={s.brand}>
    <View style={s.brandMark}><Text style={s.brandMarkText}>T</Text></View>
    <View><Text style={s.brandText}>TACHYON <Text style={s.orange}>DRIVE</Text></Text>
      <Text style={s.brandSub}>VEHICLE MANAGEMENT</Text></View>
  </View>;
}

function Heading({ children, caption }: { children: React.ReactNode; caption?: string }) {
  return <View style={{ marginBottom: 18 }}>
    <Text style={s.heading}>{children}</Text>
    {!!caption && <Text style={s.caption}>{caption}</Text>}
  </View>;
}

function Chip({ text, active = false, small = false }: { text: string; active?: boolean; small?: boolean }) {
  return <View style={[s.chip, active && s.chipActive, small && { paddingVertical: 4 }]}>
    <View style={[s.chipDot, { backgroundColor: active ? C.orange : C.muted }]} />
    <Text style={[s.chipText, active && { color: C.orange }]}>{text}</Text>
  </View>;
}

function Separator() { return <View style={s.separator}/>; }

function Metric({ icon, name, value, unit = "" }: {
  icon: keyof typeof Ionicons.glyphMap; name: string; value?: number; unit?: string;
}) {
  return <View style={s.metric}>
    <Icon name={icon} size={21} color={value === undefined ? C.muted : C.orange} />
    <Text style={s.metricName}>{name}</Text>
    <Text style={s.metricValue}>{formatValue(value, unit)}</Text>
  </View>;
}

function MenuRow({ icon, title, subtitle, onPress, right }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string;
  onPress?: () => void; right?: React.ReactNode;
}) {
  return <Pressable accessibilityRole={onPress ? "button" : undefined} onPress={onPress}
    style={({ pressed }) => [s.menuRow, pressed && onPress ? { backgroundColor: C.surfaceAlt } : null]}>
    <View style={s.menuIcon}><Icon name={icon} color={C.orange} size={23}/></View>
    <View style={s.menuText}><Text style={s.menuTitle}>{title}</Text>
      <Text style={s.menuSubtitle}>{subtitle}</Text></View>
    {right ?? (onPress ? <Icon name="chevron-forward" color={C.muted} /> : null)}
  </Pressable>;
}

export default function App() {
  const service = useRef<BleObdService | null>(null);
  if (!service.current) service.current = new BleObdService();
  const [tab, setTab] = useState<Tab>("home");
  const [demo, setDemo] = useState(false);
  const [snapshot, setSnapshot] = useState<ConnectionSnapshot>(INITIAL);
  const [devices, setDevices] = useState<FoundDevice[]>([]);
  const [scanVisible, setScanVisible] = useState(false);
  const telemetry: Telemetry = demo ? DEMO_TELEMETRY : snapshot.telemetry;
  const connected = !demo && snapshot.status === "connected";
  const hasData = demo || connected;

  useEffect(() => {
    const obd = service.current!;
    const unsubscribe = obd.subscribe(setSnapshot);
    return () => { unsubscribe(); obd.destroy(); };
  }, []);

  const startScan = useCallback(async () => {
    if (demo) setDemo(false);
    setDevices([]);
    setScanVisible(true);
    try { await service.current!.scan(setDevices); }
    catch (error) { Alert.alert("Bluetooth unavailable", error instanceof Error ? error.message : "Unable to scan"); }
  }, [demo]);

  const onConnect = useCallback(async (device: FoundDevice) => {
    setScanVisible(false);
    try { await service.current!.connect(device.id); }
    catch (error) { Alert.alert("Adapter connection failed", error instanceof Error ? error.message : "Unknown adapter error"); }
  }, []);

  const disconnect = useCallback(async () => {
    setScanVisible(false);
    await service.current?.disconnect();
  }, []);

  const metrics = useMemo(() => [
    { icon: "speedometer-outline" as const, name: "RPM", value: telemetry.rpm, unit: "" },
    { icon: "car-outline" as const, name: "Speed", value: telemetry.speedKmh, unit: "km/h" },
    { icon: "thermometer-outline" as const, name: "Coolant", value: telemetry.coolantC, unit: "°C" },
    { icon: "battery-half-outline" as const, name: "Battery", value: telemetry.batteryV, unit: "V" },
  ], [telemetry]);

  const header = <View style={s.header}>
    <Brand />
    <Pressable accessibilityLabel="Connection settings" onPress={() => setTab("settings")} style={s.headerButton}>
      <Icon name="settings-outline" color={C.foreground} size={21}/>
    </Pressable>
  </View>;

  const home = <ScrollView key="home" contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
    <View style={s.vehicleHead}>
      <View style={{ flex: 1 }}>
        <Text style={s.vehicleTitle}>Hyundai i20</Text>
        <Text style={s.vehicleSubtitle}>2018  <Text style={{ color: C.muted }}>·</Text>  GB generation</Text>
      </View>
      <Chip text={demo ? "Demo" : connected ? "Connected" : "Offline"} active={demo || connected}/>
    </View>
    <CarStage />
    <Text style={s.stageFootnote}>Model controls are visual only. No physical car functions are operated.</Text>
    <View style={s.metricsRow}>
      {metrics.map(m => <Metric key={m.name} {...m}/>)}
    </View>
    <Separator />
    <Text style={s.sectionCaption}>YOUR VEHICLE</Text>
    <MenuRow icon="pulse-outline" title="Diagnostics" subtitle="Sensor readings and read-only monitoring" onPress={() => setTab("data")}/>
    <MenuRow icon="layers-outline" title="Vehicle systems" subtitle="ECU, BCM and supported modules" onPress={() => setTab("modules")}/>
    <MenuRow icon="options-outline" title="Configuration" subtitle="Connection and application settings" onPress={() => setTab("settings")}/>
    {!hasData && <View style={s.connectionHint}>
      <Icon name="information-circle-outline" color={C.orange} size={22}/>
      <View style={{ flex: 1 }}><Text style={s.hintTitle}>No OBD adapter connected</Text>
        <Text style={s.hintText}>Connect a compatible BLE adapter to read real vehicle data.</Text></View>
      <Pressable onPress={startScan} style={s.inlineButton}><Text style={s.inlineButtonText}>Connect</Text></Pressable>
    </View>}
    {demo && <Text style={s.demoNotice}>DEMO MODE — simulated readings, not vehicle data</Text>}
  </ScrollView>;

  const data = <ScrollView key="data" contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
    <Heading caption="Read-only OBD-II sensor telemetry">Live data</Heading>
    <View style={s.dataStatus}><Chip text={demo ? "SIMULATED DATA" : connected ? "LIVE DATA" : "DISCONNECTED"} active={hasData}/>
      <Text style={s.dataState}>{demo ? "Demo values are not from your car." : snapshot.message}</Text>
    </View>
    <View style={s.dataGrid}>
      {[
        ["speedometer-outline", "Engine RPM", telemetry.rpm, "rpm"],
        ["car-outline", "Vehicle speed", telemetry.speedKmh, "km/h"],
        ["thermometer-outline", "Coolant temperature", telemetry.coolantC, "°C"],
        ["battery-half-outline", "Control module voltage", telemetry.batteryV, "V"],
        ["analytics-outline", "Engine load", telemetry.engineLoadPct, "%"],
        ["sunny-outline", "Intake air temperature", telemetry.intakeC, "°C"],
      ].map(([icon, name, value, unit]) => <View key={String(name)} style={s.dataTile}>
        <Icon name={icon as keyof typeof Ionicons.glyphMap} size={22} color={C.orange}/>
        <Text style={s.dataTileLabel}>{String(name)}</Text>
        <Text style={s.dataTileValue}>{formatValue(value as number | undefined, String(unit))}</Text>
      </View>)}
    </View>
    <Text style={s.smallNote}>Values depend on the ECU and adapter. Unsupported PIDs show “—”. No sensor value is assumed and no fault-clear commands are sent.</Text>
    {!hasData && <Pressable onPress={startScan} style={s.primaryButton}>
      <Icon name="bluetooth-outline" color={C.black}/><Text style={s.primaryText}>CONNECT OBD ADAPTER</Text>
    </Pressable>}
  </ScrollView>;

  const modules = <ScrollView key="modules" contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
    <Heading caption="Control modules and supported diagnostics">Vehicle systems</Heading>
    <View style={s.moduleBanner}><Icon name="shield-checkmark-outline" color={C.orange} size={22}/>
      <View style={{ flex: 1 }}><Text style={s.hintTitle}>Read-only by design</Text>
        <Text style={s.hintText}>Hyundai-specific BCM and ABS data require verified manufacturer protocols. Physical door commands are not enabled.</Text></View>
    </View>
    <Text style={s.sectionCaption}>AVAILABLE NOW</Text>
    <MenuRow icon="hardware-chip-outline" title="Engine ECU — standard OBD" subtitle={hasData ? "Generic PIDs enabled for display" : "Connect an adapter to read supported PIDs"} onPress={() => setTab("data")} right={<Text style={s.moduleTag}>{hasData ? "READ ONLY" : "OFFLINE"}</Text>}/>
    <Text style={[s.sectionCaption, { marginTop: 23 }]}>REQUIRES MODEL-SPECIFIC RESEARCH</Text>
    {[
      ["Body control module (BCM)", "Locks, lighting and convenience functions", "car-sport-outline"],
      ["ABS / ESC", "Brake and stability electronics", "disc-outline"],
      ["Airbag (SRS)", "Supplemental restraint diagnostics", "shield-outline"],
      ["Electric power steering", "EPS diagnostics", "git-merge-outline"],
    ].map(([title, description, icon]) => <MenuRow key={title}
      icon={icon as keyof typeof Ionicons.glyphMap} title={title} subtitle={description}
      right={<Text style={s.moduleTag}>UNVERIFIED</Text>} />)}
    <Text style={s.smallNote}>The module list is a roadmap, not evidence that all listed ECUs are present or accessible on your exact i20.</Text>
  </ScrollView>;

  const settings = <ScrollView key="settings" contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
    <Heading caption="Adapter pairing, preview and safety">Settings</Heading>
    <Text style={s.sectionCaption}>CONNECTIVITY</Text>
    <MenuRow icon="bluetooth-outline" title="OBD-II adapter" subtitle={snapshot.connectedName ?? snapshot.message}
      onPress={connected ? disconnect : startScan}
      right={<Text style={s.actionLink}>{connected ? "DISCONNECT" : "PAIR"}</Text>}/>
    <View style={s.settingRow}>
      <View style={{ flex: 1 }}><Text style={s.menuTitle}>Demo telemetry</Text>
        <Text style={s.menuSubtitle}>Clearly labeled simulated values</Text></View>
      <Switch value={demo} onValueChange={setDemo}
        trackColor={{ false: C.border, true: C.orangeMuted }} thumbColor={demo ? C.orange : C.secondary}/>
    </View>
    <Text style={[s.sectionCaption, { marginTop: 25 }]}>VEHICLE</Text>
    <MenuRow icon="car-outline" title="Hyundai i20 (2018)" subtitle="GB generation · approximate original 3D model"
      onPress={() => setTab("home")}/>
    <Text style={[s.sectionCaption, { marginTop: 25 }]}>SAFETY & LIMITATIONS</Text>
    <View style={s.explainer}><Text style={s.explainerText}>
      Door animation only moves the on-screen model. It does not unlock, open, or operate your car.
      Standard OBD polling uses read-only commands. Bluetooth Classic ELM327 adapters are not supported by this BLE-only build.
      Spotify and the car’s audio link can operate independently of a separate BLE adapter.
    </Text></View>
    <Text style={s.version}>TACHYON DRIVE  ·  PREVIEW 0.1.0</Text>
  </ScrollView>;

  return <SafeAreaProvider><SafeAreaView style={s.safe}>
    <StatusBar barStyle="light-content"/>
    {header}
    <Separator/>
    <View style={s.content}>
      {tab === "home" ? home : tab === "data" ? data : tab === "modules" ? modules : settings}
    </View>
    {scanVisible && <View style={s.scanSheet}>
      <View style={s.scanHead}><View><Text style={s.scanTitle}>Find your adapter</Text>
        <Text style={s.scanSubtitle}>Bluetooth Low Energy OBD-II</Text></View>
        <Pressable onPress={() => { setScanVisible(false); service.current?.stopScan(); }} accessibilityLabel="Close scan" style={s.scanClose}>
          <Icon name="close" color={C.foreground}/>
        </Pressable></View>
      {snapshot.status === "scanning" && <View style={s.scanProgress}><ActivityIndicator color={C.orange}/>
        <Text style={s.scanStatus}>Searching for nearby BLE devices…</Text></View>}
      {devices.length === 0 ? <Text style={s.scanEmpty}>No BLE devices discovered yet. Turn on your adapter and keep your phone nearby.</Text> :
        <FlatList data={devices} keyExtractor={item => item.id} style={{ maxHeight: 270 }}
          renderItem={({ item }) => <Pressable onPress={() => void onConnect(item)} style={s.deviceRow}>
            <Icon name="bluetooth-outline" color={C.orange}/>
            <View style={{ flex: 1 }}><Text style={s.menuTitle}>{item.name}</Text>
              <Text style={s.menuSubtitle}>{item.id}</Text></View>
            <Icon name="chevron-forward"/>
          </Pressable>}/>}
      <Text style={s.scanFoot}>Choose only your own OBD adapter. Many cheap ELM327 dongles use Bluetooth Classic instead of BLE.</Text>
    </View>}
    <View style={s.bottomNav}>
      {NAV.map(item => <Pressable key={item.id} accessibilityRole="tab"
        accessibilityState={{ selected: tab === item.id }} onPress={() => setTab(item.id)}
        style={[s.navItem, tab === item.id && s.navActive]}>
        <Icon name={item.icon} size={22} color={tab === item.id ? C.orange : C.secondary}/>
        <Text style={[s.navLabel, tab === item.id && { color: C.orange }]}>{item.label}</Text>
      </Pressable>)}
    </View>
  </SafeAreaView></SafeAreaProvider>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 19, paddingTop: 12, paddingBottom: 14 },
  headerButton: { width: 40, height: 40, borderRadius: 9, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  brand: { flexDirection: "row", alignItems: "center", gap: 11 },
  brandMark: { width: 38, height: 40, backgroundColor: C.orange, borderRadius: 7, alignItems: "center", justifyContent: "center", transform: [{ skewX: "-7deg" }] },
  brandMarkText: { fontSize: 28, fontWeight: "900", color: C.black, fontStyle: "italic" },
  brandText: { color: C.foreground, fontSize: 17, fontWeight: "800", letterSpacing: 1.45 },
  brandSub: { color: C.secondary, fontSize: 8, fontWeight: "700", letterSpacing: 2.2, marginTop: 4 },
  orange: { color: C.orange },
  separator: { height: 1, backgroundColor: C.border },
  content: { flex: 1 },
  page: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 28 },
  vehicleHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 19 },
  vehicleTitle: { fontSize: 24, fontWeight: "700", color: C.foreground, letterSpacing: -0.7 },
  vehicleSubtitle: { marginTop: 5, color: C.secondary, fontSize: 12 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 30, borderWidth: 1, borderColor: C.border },
  chipActive: { borderColor: C.orangeMuted, backgroundColor: "#2B211B" },
  chipDot: { width: 6, height: 6, borderRadius: 6 },
  chipText: { color: C.secondary, fontSize: 11, fontWeight: "600" },
  stageFootnote: { color: C.muted, fontSize: 10, textAlign: "center", marginTop: 12, marginBottom: 17 },
  metricsRow: { flexDirection: "row", paddingVertical: 16, marginBottom: 12 },
  metric: { flex: 1, alignItems: "center", gap: 8, borderRightWidth: 1, borderRightColor: C.border },
  metricName: { color: C.secondary, fontSize: 10 },
  metricValue: { color: C.foreground, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
  sectionCaption: { fontSize: 10, letterSpacing: 1.5, color: C.muted, fontWeight: "700", marginTop: 19, marginBottom: 11 },
  menuRow: { flexDirection: "row", gap: 13, alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  menuIcon: { width: 33, alignItems: "center" },
  menuText: { flex: 1 },
  menuTitle: { color: C.foreground, fontSize: 14, fontWeight: "600" },
  menuSubtitle: { color: C.secondary, fontSize: 11, marginTop: 4, lineHeight: 16 },
  connectionHint: { flexDirection: "row", gap: 12, marginTop: 24, padding: 13, borderColor: C.orangeMuted, borderWidth: 1, backgroundColor: "#241E1A", borderRadius: 9, alignItems: "center" },
  hintTitle: { fontSize: 13, fontWeight: "700", color: C.foreground },
  hintText: { fontSize: 11, lineHeight: 17, color: C.secondary, marginTop: 4 },
  inlineButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6, backgroundColor: C.orange },
  inlineButtonText: { color: C.black, fontWeight: "800", fontSize: 11 },
  demoNotice: { color: C.orange, fontSize: 10, letterSpacing: 1, textAlign: "center", marginTop: 17 },
  heading: { color: C.foreground, fontSize: 25, fontWeight: "700", letterSpacing: -0.5 },
  caption: { color: C.secondary, fontSize: 12, marginTop: 6 },
  dataStatus: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 24 },
  dataState: { flexShrink: 1, color: C.secondary, fontSize: 11 },
  dataGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  dataTile: { width: "48.3%", backgroundColor: C.surface, borderRadius: 9, borderWidth: 1, borderColor: C.border, padding: 16, minHeight: 129, justifyContent: "space-between" },
  dataTileLabel: { color: C.secondary, fontSize: 11, marginTop: 11 },
  dataTileValue: { color: C.foreground, fontWeight: "700", fontSize: 21, marginTop: 7 },
  smallNote: { color: C.muted, fontSize: 11, lineHeight: 18, marginTop: 24 },
  primaryButton: { marginTop: 22, backgroundColor: C.orange, borderRadius: 9, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, padding: 16 },
  primaryText: { color: C.black, fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  moduleBanner: { flexDirection: "row", gap: 14, borderWidth: 1, borderColor: C.orangeMuted, borderRadius: 10, padding: 14, backgroundColor: "#251E19" },
  moduleTag: { color: C.muted, fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
  actionLink: { color: C.orange, fontSize: 12, fontWeight: "700" },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: C.border, paddingVertical: 18 },
  explainer: { borderLeftWidth: 2, borderLeftColor: C.orange, paddingLeft: 15, paddingVertical: 5 },
  explainerText: { color: C.secondary, fontSize: 12, lineHeight: 21 },
  version: { fontSize: 10, letterSpacing: 1.2, color: C.muted, textAlign: "center", marginTop: 40 },
  bottomNav: { flexDirection: "row", paddingHorizontal: 8, paddingTop: 6, paddingBottom: 6, borderTopWidth: 1, borderColor: C.border, backgroundColor: C.bg },
  navItem: { flex: 1, alignItems: "center", paddingVertical: 8, gap: 5, borderTopWidth: 2, borderTopColor: "transparent" },
  navActive: { borderTopColor: C.orange },
  navLabel: { fontSize: 10, color: C.secondary, fontWeight: "600" },
  scanSheet: { position: "absolute", zIndex: 10, left: 0, right: 0, bottom: 62, maxHeight: "70%", backgroundColor: C.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, borderWidth: 1, borderColor: C.border },
  scanHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  scanTitle: { fontSize: 18, fontWeight: "700", color: C.foreground },
  scanSubtitle: { color: C.secondary, fontSize: 11, marginTop: 5 },
  scanClose: { padding: 9 },
  scanProgress: { flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 10 },
  scanStatus: { color: C.secondary, fontSize: 11 },
  scanEmpty: { color: C.muted, fontSize: 12, lineHeight: 19, paddingVertical: 16 },
  deviceRow: { flexDirection: "row", gap: 13, alignItems: "center", borderBottomColor: C.border, borderBottomWidth: 1, paddingVertical: 16 },
  scanFoot: { color: C.muted, fontSize: 11, lineHeight: 18, marginTop: 14 },
});
