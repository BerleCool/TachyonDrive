import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as Label } from 'react-native-svg';
import type { Point } from '../core/trips';
const ORANGE = '#FF8735';
const xy = (angle: number, radius: number) => ({ x: 170 + Math.cos(angle * Math.PI / 180) * radius, y: 170 + Math.sin(angle * Math.PI / 180) * radius });
const arc = (a: number, b: number, r: number) => {
  const start = xy(a, r), end = xy(b, r);
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${end.x} ${end.y}`;
};
export function Speedometer({ speed, alert, preview = false }: { speed: number | null; alert: number | null; preview?: boolean }) {
  const value = useRef(new Animated.Value(0)).current;
  const [smooth, setSmooth] = useState(0);
  useEffect(() => { const id = value.addListener(v => setSmooth(v.value)); return () => value.removeListener(id); }, [value]);
  useEffect(() => { Animated.timing(value, { toValue: Math.min(200, speed ?? 0), duration: 420, useNativeDriver: false }).start(); }, [speed, value]);
  const exceeded = speed !== null && alert !== null && speed > alert;
  const color = exceeded ? '#F17067' : ORANGE;
  const end = 140 + smooth / 200 * 260;
  const marker = xy(end, 150);
  return <View accessibilityLabel={speed === null ? 'Waiting for GPS speed' : `${Math.round(speed)} kilometres per hour`}>
    <Svg width="100%" viewBox="0 0 340 310" style={{ aspectRatio: 340 / 310 }}>
      <Path d={arc(140, 400, 150)} stroke="#303338" strokeWidth={3} fill="none" />
      {smooth > .1 && <Path d={arc(140, end, 150)} stroke={color} strokeWidth={3} fill="none" />}
      {Array.from({ length: 51 }, (_, i) => {
        const angle = 140 + i / 50 * 260, major = i % 5 === 0;
        const outer = xy(angle, 140), inner = xy(angle, major ? 125 : 133);
        return <Line key={i} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} stroke={i * 4 <= smooth && speed !== null ? color : major ? '#C7C6C1' : '#4C5055'} strokeWidth={major ? 2 : 1} />;
      })}
      {[0, 40, 80, 120, 160, 200].map(n => {
        const p = xy(140 + n / 200 * 260, 108);
        return <Label key={n} x={p.x} y={p.y + 4} fill="#9B9FA6" fontSize={12} fontWeight="500" textAnchor="middle">{n}</Label>;
      })}
      {alert !== null && alert <= 200 && <G><Circle cx={xy(140 + alert / 200 * 260, 150).x} cy={xy(140 + alert / 200 * 260, 150).y} r={4} fill="#F17067" /></G>}
      {speed !== null && <Circle cx={marker.x} cy={marker.y} r={5} fill={color} />}
      <Label x={170} y={118} fill={preview ? ORANGE : '#8E939B'} fontSize={10} fontWeight="600" letterSpacing={3} textAnchor="middle">{preview ? 'PREVIEW' : 'GPS SPEED'}</Label>
      <Label x={170} y={193} fill="#F5F1EA" fontSize={78} fontWeight="600" letterSpacing={-5} textAnchor="middle">{speed === null ? '\u2014' : Math.round(speed)}</Label>
      <Label x={170} y={221} fill="#9B9FA6" fontSize={14} letterSpacing={2} textAnchor="middle">km/h</Label>
      <Label x={170} y={278} fill={exceeded ? '#F17067' : '#81868D'} fontSize={10} letterSpacing={2} textAnchor="middle">{exceeded ? 'ABOVE YOUR SET ALERT' : 'PHONE GPS / NOT VEHICLE SENSORS'}</Label>
    </Svg>
  </View>;
}
export function RouteTrace({ route }: { route: Point[] }) {
  if (route.length < 2) return <View className="h-40 items-center justify-center bg-panel rounded-2xl"><Text className="text-muted text-xs">A GPS trace appears after you drive.</Text></View>;
  const meanLat = route.reduce((s, p) => s + p.latitude, 0) / route.length * Math.PI / 180;
  const coords = route.map(p => ({ x: p.longitude * Math.cos(meanLat), y: -p.latitude, breakBefore: p.breakBefore }));
  const minX = Math.min(...coords.map(p => p.x)), maxX = Math.max(...coords.map(p => p.x));
  const minY = Math.min(...coords.map(p => p.y)), maxY = Math.max(...coords.map(p => p.y));
  const spanX = Math.max(maxX - minX, .0001), spanY = Math.max(maxY - minY, .0001);
  const scale = Math.min(272 / spanX, 112 / spanY);
  const points = coords.map(p => ({ x: 160 + (p.x - (minX + maxX) / 2) * scale, y: 80 + (p.y - (minY + maxY) / 2) * scale, breakBefore: p.breakBefore }));
  const d = points.map((p, i) => `${i === 0 || p.breakBefore ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  return <View className="bg-panel rounded-2xl overflow-hidden">
    <Svg width="100%" viewBox="0 0 320 160" style={{ aspectRatio: 2 }}>
      {Array.from({ length: 9 }, (_, i) => <Line key={'x' + i} x1={i * 40} y1={0} x2={i * 40} y2={160} stroke="#2D3034" strokeWidth={.6} />)}
      {Array.from({ length: 5 }, (_, i) => <Line key={'y' + i} x1={0} y1={i * 40} x2={320} y2={i * 40} stroke="#2D3034" strokeWidth={.6} />)}
      <Path d={d} fill="none" stroke={ORANGE} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={points[0].x} cy={points[0].y} r={4} fill="#9B9FA6" />
      <Circle cx={points.at(-1)!.x} cy={points.at(-1)!.y} r={5} fill={ORANGE} stroke="#191A1C" strokeWidth={2} />
      <Label x={298} y={18} fill="#8E939B" textAnchor="middle" fontSize={10}>N</Label>
    </Svg>
    <Text className="text-muted text-[10px] px-4 pb-3">GPS TRACE / OFFLINE / NOT A NAVIGATION MAP</Text>
  </View>;
}
export function DayBars({ data }: { data: { day: string; cost: number }[] }) {
  const max = Math.max(...data.map(d => d.cost), 1);
  return <View className="flex-row items-end gap-3 h-32 mt-5" accessibilityLabel="Estimated fuel costs over the last seven days">
    {data.map((d, index) => <View key={d.day} className="flex-1 items-center gap-2">
      <View className="w-full justify-end h-24"><View style={{ height: Math.max(3, d.cost / max * 88), backgroundColor: index === data.length - 1 ? ORANGE : '#4C443D', borderRadius: 3 }} /></View>
      <Text className="text-muted text-[10px]">{d.day.slice(8)}</Text>
    </View>)}
  </View>;
}
