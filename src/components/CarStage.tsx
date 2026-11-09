import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Canvas } from "@react-three/fiber/native";
import { Ionicons } from "@expo/vector-icons";
import * as THREE from "three";
import { CarModel } from "./CarModel";
import { C } from "../theme";
import { CLOSED_DOORS, type DoorKey, type DoorState } from "../types";

/**
 * The 3D scene is a functional model-only preview.
 * Buttons affect local state only; no remote vehicle locks are touched.
 */
export function CarStage() {
  const [doors, setDoors] = useState<DoorState>({ ...CLOSED_DOORS });
  const [angle, setAngle] = useState(0);
  const [focused, setFocused] = useState<DoorKey | null>(null);
  const opened = useMemo(() => Object.values(doors).filter(Boolean).length, [doors]);
  const toggle = (key: DoorKey) => {
    setDoors(prev => ({ ...prev, [key]: !prev[key] }));
    setFocused(key);
  };
  const turn = (delta: number) => setAngle(a => (a + delta + 360) % 360);
  const anyOpen = opened > 0;
  return <View style={styles.root}>
    <View style={styles.stage}>
      <Canvas
        style={StyleSheet.absoluteFill}
        shadows
        camera={{ position: [5.6, 3.25, 7.7], fov: 34, near: 0.1, far: 50 }}
        onCreated={({ gl }) => { gl.setClearColor(new THREE.Color(C.stage), 1); }}>
        <ambientLight intensity={1.5} />
        <hemisphereLight intensity={1.4} groundColor={"#0E0F10"} />
        <directionalLight position={[-4, 8, 6]} intensity={2.9} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[4, 3, -4]} intensity={1.3} color="#F4A06C" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <meshStandardMaterial color="#1D1E20" roughness={0.46} metalness={0.18} />
        </mesh>
        <group rotation={[0, angle * Math.PI / 180, 0]}>
          <CarModel doors={doors} onDoorPress={toggle} />
        </group>
      </Canvas>
      <View style={styles.stageLabel}>
        <Text style={styles.stageLabelText}>INTERACTIVE 3D PREVIEW</Text>
        <View style={styles.previewDot}/>
      </View>
      <View style={styles.orbit}>
        <Pressable accessibilityLabel="Rotate vehicle left" onPress={() => turn(-35)} style={styles.orbitButton}>
          <Ionicons name="chevron-back" size={23} color={C.foreground}/>
        </Pressable>
        <View style={styles.orbitCenter}><Ionicons name="sync-outline" size={16} color={C.orange} />
          <Text style={styles.orbitText}>{Math.round(angle)}°</Text></View>
        <Pressable accessibilityLabel="Rotate vehicle right" onPress={() => turn(35)} style={styles.orbitButton}>
          <Ionicons name="chevron-forward" size={23} color={C.foreground}/>
        </Pressable>
      </View>
    </View>
    <View style={styles.doorHead}>
      <View><Text style={styles.sectionTitle}>Door preview</Text>
        <Text style={styles.sectionHint}>Animate doors on the model only</Text></View>
      <Pressable onPress={() => { setDoors(anyOpen ? { ...CLOSED_DOORS } : { frontLeft: true, frontRight: true, rearLeft: true, rearRight: true }); setFocused(null); }} style={styles.allButton}>
        <Ionicons name={anyOpen ? "lock-closed-outline" : "lock-open-outline"} color={C.orange} size={16} />
        <Text style={styles.allText}>{anyOpen ? "Close all" : "Open all"}</Text>
      </Pressable>
    </View>
    <View style={styles.doorControls}>
      {([
        ["frontLeft", "Front L"], ["frontRight", "Front R"],
        ["rearLeft", "Rear L"], ["rearRight", "Rear R"],
      ] as [DoorKey, string][]).map(([key, label]) => (
        <Pressable key={key} onPress={() => toggle(key)}
          accessibilityRole="button"
          accessibilityLabel={label + " door " + (doors[key] ? "open" : "closed")}
          style={[styles.doorButton, doors[key] && styles.doorButtonActive]}>
          <Ionicons name={doors[key] ? "lock-open-outline" : "lock-closed-outline"}
            color={doors[key] ? C.orange : C.secondary} size={17}/>
          <Text style={[styles.doorText, doors[key] && styles.activeText]}>{label}</Text>
        </Pressable>
      ))}
    </View>
    {focused && <Text style={styles.feedback}>{focused.replace(/([A-Z])/g, " $1")} door {doors[focused] ? "opened" : "closed"} in 3D preview</Text>}
  </View>;
}
const styles = StyleSheet.create({
  root: { width: "100%" },
  stage: { height: 290, backgroundColor: C.stage, overflow: "hidden", borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  stageLabel: { position: "absolute", top: 13, left: 17, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(16,17,18,.85)", paddingVertical: 6, paddingHorizontal: 9, borderRadius: 4 },
  stageLabelText: { fontSize: 9, fontWeight: "700", letterSpacing: 1.1, color: C.secondary },
  previewDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.orange },
  orbit: { position: "absolute", bottom: 12, alignSelf: "center", flexDirection: "row", alignItems: "center", backgroundColor: "rgba(19,20,21,.91)", borderColor: C.border, borderWidth: 1, borderRadius: 50 },
  orbitButton: { paddingHorizontal: 16, paddingVertical: 9 },
  orbitCenter: { flexDirection: "row", alignItems: "center", gap: 5, minWidth: 66, justifyContent: "center" },
  orbitText: { color: C.secondary, fontSize: 12, fontVariant: ["tabular-nums"] },
  doorHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 17, paddingBottom: 11, paddingHorizontal: 19 },
  sectionTitle: { color: C.foreground, fontSize: 15, fontWeight: "700" },
  sectionHint: { color: C.muted, fontSize: 11, marginTop: 3 },
  allButton: { borderColor: C.border, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 8 },
  allText: { color: C.foreground, fontSize: 11, fontWeight: "600" },
  doorControls: { flexDirection: "row", paddingHorizontal: 14, gap: 6 },
  doorButton: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12, gap: 7, backgroundColor: C.surface, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  doorButtonActive: { borderColor: C.orange, backgroundColor: "#31251D" },
  doorText: { color: C.secondary, fontSize: 10, fontWeight: "600" },
  activeText: { color: C.orange },
  feedback: { paddingTop: 8, color: C.muted, textAlign: "center", textTransform: "capitalize", fontSize: 10 },
});
