import React, { useState } from 'react';
import { CarViewer } from '../components/CarViewer';
import { Image, Pressable, Text, View } from 'react-native';
import { dayKey, tripEstimate, monthKey, totals, validRates } from '../core/trips';
import { useStore } from '../services/store';
import { beginDrive } from '../services/location';
import { Button, Eyebrow, Icon, Metric, Notice, Row, Screen } from '../ui/primitives';
import { km, money } from '../ui/format';
export function Home({ navigate, run }: { navigate: (tab: string) => void; run: (work: () => Promise<void>) => void }) {
  const { prefs, active, trips } = useStore();
  const [viewer, setViewer] = useState(false);
  const all = active ? [...trips, active] : trips;
  const today = totals(all, dayKey(Date.now(), prefs.timeZone));
  const month = totals(all, monthKey(Date.now(), prefs.timeZone));
  return <>
  <Screen>
    <View className="flex-row items-start justify-between">
      <View className="flex-1 pr-3"><Eyebrow>HYUNDAI / 2018</Eyebrow><Text numberOfLines={1} adjustsFontSizeToFit className="text-ink text-[56px] leading-[62px] font-semibold tracking-[-3px]">i20<Text className="text-muted text-base tracking-normal">  {prefs.nickname === 'My i20' ? 'GB' : prefs.nickname}</Text></Text></View>
      <View className="flex-row items-center gap-2 pt-2"><View className="w-1.5 h-1.5 rounded-full bg-accent" /><Text className="text-muted text-[10px] tracking-wider">PHONE MODE</Text></View>
    </View>
    <View className="mt-2 -mx-3 h-[208px] overflow-hidden justify-center">
      <View className="absolute bottom-5 left-10 right-10 h-8 rounded-full bg-black/25" />
      <Image accessibilityLabel={prefs.photoUri ? 'Your car photo' : 'Reference photograph of a 2018 Hyundai i20, not an interactive 3D model'} source={prefs.photoUri ? { uri: prefs.photoUri } : require('../../assets/i20-2018.png')} resizeMode="contain" style={{ width: '100%', height: 200 }} />
    </View>
    <View className="flex-row justify-between items-center pb-5 border-b border-line">
      <Text className="text-muted text-[10px] tracking-wider">{prefs.photoUri ? 'YOUR CAR' : '2018 i20 / REFERENCE PHOTO'}</Text>
      <View className="flex-row items-center gap-3"><Pressable onPress={() => setViewer(true)} accessibilityRole="button" accessibilityLabel="Explore interactive 3D Hyundai i20" className="flex-row items-center gap-2 py-2"><Icon name="cube-outline" size={16} color="#FF8735" /><Text className="text-accent text-xs font-semibold">3D VIEW</Text></Pressable><Pressable onPress={() => navigate('garage')} accessibilityRole="button" accessibilityLabel="Customize vehicle" className="flex-row items-center gap-2 py-2"><Text className="text-muted text-xs">Garage</Text><Icon name="arrow-forward" size={14} /></Pressable></View>
    </View>
    <View className="pt-6 pb-5">
      <View className="flex-row justify-between items-center mb-4"><Eyebrow>{active ? 'YOUR OPEN DRIVE' : 'READY WHEN YOU ARE'}</Eyebrow><Icon name={active ? 'navigate-outline' : 'location-outline'} color="#FF8735" size={17} /></View>
      {active ? <>
        <View className="flex-row gap-8 mb-5"><Metric label="Trip distance" value={km(active.metres)} unit="km" /><Metric label="Estimated fuel" value={money(tripEstimate(active)?.cost ?? null)} /></View>
        <Button title={active.status === 'paused' ? 'Return to paused drive' : 'Open driving display'} icon="arrow-forward" onPress={() => navigate('drive')} />
      </> : <Button title="Start a drive" icon="arrow-forward" onPress={() => run(async () => { await beginDrive(); navigate('drive'); })} />}
      <Text className="text-muted text-[11px] leading-5 text-center mt-3">GPS tracking. No adapter. No laptop. Your data stays here.</Text>
    </View>
    <View className="flex-row border-y border-line py-5 gap-6">
      <Metric label="Today / estimated" value={money(today.unpricedMetres ? null : today.cost)} />
      <View className="w-px bg-line" />
      <Metric label="Month / estimated" value={money(month.unpricedMetres ? null : month.cost)} />
    </View>
    {!validRates(prefs) && <Notice accent>Set your consumption and fuel price in Garage to enable cost estimates. Speed and trip recording already work without them.</Notice>}
    <Row icon="receipt-outline" title="Your driving log" subtitle={`${km(month.metres)} km recorded this month`} onPress={() => navigate('trips')} />
    <Row icon="musical-notes-outline" title="Your music stays yours" subtitle="Connect Spotify to the stereo normally. Tachyon doesn't take over audio." onPress={() => navigate('garage')} />
  </Screen>
  <CarViewer visible={viewer} onClose={() => setViewer(false)} />
  </>;
}
