import React, { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber/native";
import * as THREE from "three";
import type { DoorKey, DoorState } from "../types";

/**
 * Original stylized geometry inspired by the 2014-2020 i20 GB hatchback.
 * Intentionally approximate; a verified licensed 2018 mesh can replace it.
 * Dimensions in arbitrary scene units, front is -Z.
 */
const paint = new THREE.MeshStandardMaterial({ color: "#45484A", metalness: 0.8, roughness: 0.29 });
const paintHighlight = new THREE.MeshStandardMaterial({ color: "#66696B", metalness: 0.75, roughness: 0.29 });
const glass = new THREE.MeshPhysicalMaterial({ color: "#172127", roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.85, clearcoat: 0.75 });
const rubber = new THREE.MeshStandardMaterial({ color: "#121416", roughness: 0.94 });
const chrome = new THREE.MeshStandardMaterial({ color: "#BDC0C0", metalness: 0.95, roughness: 0.17 });
const lights = new THREE.MeshStandardMaterial({ color: "#E5E2DA", emissive: "#A7ADB4", emissiveIntensity: 0.25 });
const red = new THREE.MeshStandardMaterial({ color: "#A63727", emissive: "#5C130D", emissiveIntensity: 0.2 });
const dark = new THREE.MeshStandardMaterial({ color: "#0B0D0D", metalness: 0.15, roughness: 0.7 });
const orange = new THREE.MeshBasicMaterial({ color: "#F47A2A" });

function Cube({ position, scale, material, rotation }: {
  position: [number, number, number]; scale: [number, number, number];
  material: THREE.Material; rotation?: [number, number, number];
}) {
  return <mesh position={position} scale={scale} rotation={rotation} material={material} castShadow receiveShadow>
    <boxGeometry args={[1, 1, 1]} />
  </mesh>;
}

function Wheel({ side, z }: { side: -1 | 1; z: number }) {
  return <group position={[side * 0.88, 0.34, z]} rotation={[0, 0, Math.PI / 2]}>
    <mesh material={rubber} castShadow><cylinderGeometry args={[0.35, 0.35, 0.19, 32]} /></mesh>
    <mesh position={[0, side * 0.104, 0]} rotation={[0, 0, 0]} material={chrome}>
      <cylinderGeometry args={[0.235, 0.235, 0.012, 24]} />
    </mesh>
    {Array.from({ length: 5 }, (_, i) => (
      <mesh key={i} material={dark} position={[0, side * 0.114, 0]} rotation={[0, (i * Math.PI * 2) / 5, 0]}>
        <boxGeometry args={[0.045, 0.014, 0.32]} />
      </mesh>
    ))}
  </group>;
}

function Door({ side, rear, open, onDoorClick }: {
  side: -1 | 1; rear: boolean; open: boolean; onDoorClick?: () => void;
}) {
  // Door mesh has a real edge pivot, not a visual opacity trick.
  // Hinges on front edge (negative Z); outward swing angle varies with side.
  const pivot = useRef<THREE.Group>(null);
  const x = side * 0.79;
  const front = rear ? 0.08 : -1.21;
  const length = rear ? 0.89 : 1.27;
  const swing = open ? (side === 1 ? -1 : 1) * 0.94 : 0;
  useFrame((_state, delta) => {
    if (!pivot.current) return;
    pivot.current.rotation.y = THREE.MathUtils.damp(pivot.current.rotation.y, swing, 8, delta);
  });
  return <group ref={pivot} position={[x, 0, front]}>
    <group position={[0, 0, length / 2]}>
      <Cube position={[0, 0.97, 0]} scale={[0.085, 0.69, length - 0.035]} material={paint} />
      <Cube position={[0, 1.47, -0.08]} scale={[0.055, 0.36, length - 0.18]} material={glass} />
      <Cube position={[side * 0.055, 1.23, 0.05]} scale={[0.042, 0.035, 0.19]} material={chrome} />
      <Cube position={[side * 0.04, 1.32, rear ? -0.22 : -0.36]}
        scale={[0.13, 0.11, 0.2]} material={paintHighlight} />
    </group>
    {/* Transparent hit target for tap-to-toggle a door */}
    {onDoorClick && <mesh onClick={onDoorClick} position={[0, 1.18, length / 2]}>
      <boxGeometry args={[0.2, 1.13, length]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>}
  </group>;
}

export function CarModel({ doors, onDoorPress }: {
  doors: DoorState; onDoorPress?: (door: DoorKey) => void;
}) {
  return <group rotation={[0, Math.PI / 6, 0]}>
    {/* Undercarriage and sculpted three-box-hatch silhouette */}
    <Cube position={[0, 0.66, 0]} scale={[1.66, 0.52, 3.68]} material={paint} />
    <Cube position={[0, 0.96, -1.30]} scale={[1.65, 0.2, 0.93]} material={paintHighlight} />
    <Cube position={[0, 1.40, 0.13]} scale={[1.47, 0.43, 2.37]} material={glass} />
    <Cube position={[0, 1.69, 0.24]} scale={[1.33, 0.14, 1.99]} material={paint} />
    {/* Windscreen and rear windscreen slope */}
    <Cube position={[0, 1.45, -0.91]} scale={[1.42, 0.042, 0.75]} material={glass} rotation={[-0.78, 0, 0]} />
    <Cube position={[0, 1.45, 1.19]} scale={[1.42, 0.04, 0.57]} material={glass} rotation={[0.67, 0, 0]} />
    {/* B-pillars / door frame partitions */}
    {[-1, 1].map(side => (
      <React.Fragment key={side}>
        <Cube position={[side * 0.805, 1.36, 0.04]} scale={[0.06, 0.67, 0.068]} material={dark} />
        <Cube position={[side * 0.81, 1.40, 1.16]} scale={[0.07, 0.48, 0.09]} material={dark} rotation={[0.32, 0, 0]} />
      </React.Fragment>
    ))}
    <Cube position={[0, 0.58, -1.87]} scale={[1.54, 0.36, 0.16]} material={paintHighlight} />
    <Cube position={[0, 0.58, -1.958]} scale={[1.07, 0.28, 0.03]} material={dark} />
    <Cube position={[0, 0.57, 1.86]} scale={[1.52, 0.35, 0.16]} material={paintHighlight} />
    <Cube position={[0, 1.72, 1.42]} scale={[1.45, 0.07, 0.28]} material={paint} />
    {/* Headlamps, fog lamps, tail lamps */}
    {([-1, 1] as const).map(side => (
      <React.Fragment key={side}>
        <Wheel side={side} z={-1.15} /><Wheel side={side} z={1.17} />
        <Cube position={[side * 0.61, 0.95, -1.89]} scale={[0.32, 0.16, 0.11]} material={lights} />
        <Cube position={[side * 0.64, 0.52, -1.962]} scale={[0.23, 0.08, 0.06]} material={chrome} />
        <Cube position={[side * 0.65, 1.09, 1.85]} scale={[0.23, 0.27, 0.08]} material={red} />
        <Door side={side} rear={false} open={doors[side === -1 ? "frontLeft" : "frontRight"]}
          onDoorClick={onDoorPress ? () => onDoorPress(side === -1 ? "frontLeft" : "frontRight") : undefined} />
        <Door side={side} rear open={doors[side === -1 ? "rearLeft" : "rearRight"]}
          onDoorClick={onDoorPress ? () => onDoorPress(side === -1 ? "rearLeft" : "rearRight") : undefined} />
      </React.Fragment>
    ))}
    {/* Narrow Hyundai-style grill and front badge abstraction */}
    <Cube position={[0, 0.84, -1.969]} scale={[0.84, 0.14, 0.014]} material={dark} />
    <mesh position={[0, 1.02, -1.969]} material={chrome}><torusGeometry args={[0.11, 0.023, 8, 20]} /></mesh>
    <Cube position={[0, 0.3, -1.85]} scale={[1.12, 0.06, 0.07]} material={chrome} />
    {/* Orange identification marker: model-only, not a vehicle state */}
    <mesh material={orange} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[2.15, 2.166, 70]} />
    </mesh>
  </group>;
}
