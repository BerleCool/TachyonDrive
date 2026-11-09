import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { estimate, elapsedMs, freshSpeed } from '../core/trips';
import { useStore } from '../services/store';
import { useGPS, beginDrive, resumeDrive, pauseDrive, finishDrive, previewGPS, stopPreview } from '../services/location';
import { Speedometer } from '../ui/instruments';
import { Button, Eyebrow, Icon, Metric, Notice, Screen } from '../ui/primitives';
import { duration, km, money } from '../ui/format';
export function Drive({ now, run, confirm, focus, setFocus }: { now: number; run: (f: () => Promise<void>) => void; confirm: (title: string, message: string, action: () => Promise<void>) => void; focus: boolean; setFocus: (b: boolean) => void }) {
  const { active, prefs } = useStore();
  const gps = useGPS();
  const [demoSpeed, setDemoSpeed] = useState<number | null>(null);
  const preview = !active && demoSpeed !== null;
  const speed = preview ? demoSpeed : freshSpeed(gps.fix, gps.speed, now);
  const estimateNow = active ? estimate(active.metres, active.rates) : null;
  return <Screen>
    <View className="flex-row justify-between items-center mb-3">
      <View><Eyebrow>{preview ? 'INSTRUMENT PREVIEW' : active?.status === 'paused' ? 'DRIVE PAUSED' : active ? 'DRIVE IN PROGRESS' : 'DRIVING DISPLAY'}</Eyebrow><Text className="text-muted text-xs mt-2">{preview ? 'Simulated speed. Nothing is recorded.' : active?.status === 'paused' ? 'Your trip is saved. Resume when ready.' : gps.mode === 'background' ? 'Recording with the screen on or off' : gps.mode === 'foreground' ? 'Recording / keep this app open' : 'Enable GPS or start a drive'}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={focus ? 'Exit focus mode' : 'Enter focus mode'} onPress={() => setFocus(!focus)} className="w-12 h-12 items-center justify-center rounded-full border border-line"><Icon name={focus ? 'contract-outline' : 'expand-outline'} size={19} /></Pressable>
    </View>
    <Speedometer speed={speed} alert={prefs.speedAlert} preview={preview} />
    {preview ? <View className="flex-row gap-2 justify-center mb-5">{[0, 50, 90, 130].map(s => <Pressable key={s} accessibilityRole="button" accessibilityLabel={`Preview ${s} kilometres per hour`} onPress={() => setDemoSpeed(s)} className={`px-4 py-3 rounded-lg ${demoSpeed === s ? 'bg-accent' : 'bg-panel'}`}><Text className={demoSpeed === s ? 'text-[#191A1C] font-semibold' : 'text-muted'}>{s}</Text></Pressable>)}</View> : <View className="flex-row justify-center items-center gap-2 mb-5"><View className={`w-1.5 h-1.5 rounded-full ${speed === null ? 'bg-muted' : 'bg-accent'}`} /><Text className="text-muted text-[11px]">{speed === null ? 'Waiting for a reliable GPS fix' : `GPS accuracy ${Math.round(gps.fix?.accuracy ?? 0)} m`}</Text></View>}
    <View className="flex-row border-y border-line py-5 gap-5">
      <Metric label="Distance" value={km(active?.metres ?? 0)} unit="km" />
      <Metric label="Trip time" value={duration(active ? elapsedMs(active, now) : 0)} />
      <Metric label="Est. fuel cost" value={money(estimateNow?.cost ?? null, 1)} />
    </View>
    <View className="mt-5 gap-3">
      {active ? <>
        <Button title={active.status === 'paused' ? 'Resume drive' : 'Pause recording'} icon={active.status === 'paused' ? 'play' : 'pause'} onPress={() => run(active.status === 'paused' ? resumeDrive : pauseDrive)} />
        <Button secondary title="Finish and save" icon="checkmark" onPress={() => confirm('Finish this drive?', 'Your trip and cost estimate will be saved on this phone.', finishDrive)} />
      </> : <>
        <Button title="Start a drive" icon="play" onPress={() => { setDemoSpeed(null); run(beginDrive); }} />
        <View className="flex-row gap-3"><View className="flex-1"><Button secondary title="GPS only" icon="locate-outline" onPress={() => { setDemoSpeed(null); run(previewGPS); }} /></View><View className="flex-1"><Button secondary title={preview ? 'Exit preview' : 'Preview dial'} onPress={() => { stopPreview(); setDemoSpeed(preview ? null : 50); }} /></View></View>
      </>}
    </View>
    {!focus && <>
      <View className="flex-row gap-6 pt-6"><Metric label="Moving average" value={active && active.movingMs > 0 ? (active.metres / active.movingMs * 3600).toFixed(0) : '\u2014'} unit="km/h" /><Metric label="Max GPS speed" value={active ? Math.round(active.maxSpeedKmh).toString() : '\u2014'} unit="km/h" /></View>
      <Notice>Fuel is a distance-based estimate, not measured consumption. Idling, driving style and unrecorded GPS gaps are not included. Use the vehicle's speedometer and interact only while parked.</Notice>
      {!!active?.gaps && <Text className="text-accent text-xs">{active.gaps} GPS gap(s). Distance may be undercounted.</Text>}
    </>}
  </Screen>;
}
