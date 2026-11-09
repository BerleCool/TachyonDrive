import React, { useState } from 'react';
import { Linking, Platform, Pressable, Switch, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { calibratedConsumption, parsePositive } from '../core/trips';
import { useStore, savePreferences, addFuel, deleteFuel, eraseHistory } from '../services/store';
import { enableBackground, rememberParking } from '../services/location';
import { Button, Eyebrow, Field, Icon, Notice, Row, Screen, Title } from '../ui/primitives';
import { Sheet } from '../ui/dialogs';
import { dateLabel, money, number } from '../ui/format';
type Props = { run: (work: () => Promise<void>) => void; confirm: (title: string, message: string, action: () => Promise<void>) => void };
export function Garage({ run, confirm }: Props) {
  const { prefs, fuel, active, parking } = useStore();
  const [nickname, setNickname] = useState(prefs.nickname);
  const [efficiency, setEfficiency] = useState(prefs.litresPer100Km?.toString() ?? '');
  const [price, setPrice] = useState(prefs.pricePerLitre?.toString() ?? '');
  const [mass, setMass] = useState(String(prefs.massKg ?? 1150));
  const [fuelType, setFuelType] = useState<'petrol' | 'diesel'>(prefs.fuelType ?? 'petrol');
  const [budget, setBudget] = useState(prefs.monthlyBudget?.toString() ?? '');
  const [alert, setAlert] = useState(prefs.speedAlert?.toString() ?? '');
  const [unit, setUnit] = useState<'l100' | 'kml'>('l100');
  const [saved, setSaved] = useState(false);
  const [showFill, setShowFill] = useState(false);
  const [litres, setLitres] = useState('');
  const [fillPrice, setFillPrice] = useState(prefs.pricePerLitre?.toString() ?? '');
  const [odo, setOdo] = useState('');
  const [full, setFull] = useState(true);
  const calibration = calibratedConsumption(fuel);
  const optional = (value: string, min: number, max: number, label: string) => {
    if (!value.trim()) return null;
    const parsed = parsePositive(value, min, max);
    if (parsed === null) throw new Error(`Enter a valid ${label} (${min}-${max}).`);
    return parsed;
  };
  async function save() {
    const input = optional(efficiency, unit === 'l100' ? 1 : 2, unit === 'l100' ? 50 : 100, 'consumption');
    await savePreferences({ nickname: nickname.trim().slice(0, 30) || 'My i20', litresPer100Km: input === null ? null : unit === 'kml' ? 100 / input : input,
      pricePerLitre: optional(price, .1, 100, 'fuel price'),
      massKg: optional(mass, 800, 2500, 'vehicle mass') ?? 1150, fuelType,
      monthlyBudget: optional(budget, 1, 100000, 'budget'), speedAlert: optional(alert, 10, 200, 'speed alert') });
    setSaved(true);
  }
  async function choosePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [2, 1], quality: .85 });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    if (Platform.OS === 'web') { await savePreferences({ photoUri: uri }); return; }
    if (!FileSystem.documentDirectory) throw new Error('Photo storage is unavailable.');
    const to = FileSystem.documentDirectory + 'car-' + Date.now() + '.jpg';
    await FileSystem.copyAsync({ from: uri, to });
    await savePreferences({ photoUri: to });
  }
  async function saveFill() {
    const l = parsePositive(litres, .1, 150), p = parsePositive(fillPrice, .1, 100);
    if (l === null || p === null) throw new Error('Enter the litres and price per litre from your receipt.');
    await addFuel({ litres: l, pricePerLitre: p, odometerKm: optional(odo, 0, 2000000, 'odometer reading'), fullTank: full });
    setShowFill(false); setLitres(''); setOdo('');
  }
  return <Screen>
    <Title title="Your garage." subtitle="Hyundai i20 / 2018 / phone-powered companion" />
    <Row icon="camera-outline" title="Use my car photo" subtitle={prefs.photoUri ? 'Your saved photo is shown on Home' : 'Replace the 2018 reference with your own i20'} onPress={() => run(choosePhoto)} />
    {prefs.photoUri && <Pressable onPress={() => run(() => savePreferences({ photoUri: null }))} className="py-3"><Text className="text-accent text-xs">Restore the 2018 reference photo</Text></Pressable>}
    <View className="mt-6"><Field label="Vehicle nickname" value={nickname} onChangeText={v => { setNickname(v); setSaved(false); }} maxLength={30} /></View>
    <View className="flex-row justify-between items-center mb-4 mt-3"><Eyebrow>FUEL ESTIMATE SETTINGS</Eyebrow><View className="flex-row gap-1">{(['l100', 'kml'] as const).map(u => <Pressable accessibilityRole="button" key={u} onPress={() => { if (u !== unit) { const n = parsePositive(efficiency, .1, 100); setEfficiency(n ? (100 / n).toFixed(2) : ''); setUnit(u); setSaved(false); } }} className={`px-3 py-2 rounded-lg ${unit === u ? 'bg-accent' : 'bg-panel'}`}><Text className={`text-[10px] font-semibold ${unit === u ? 'text-[#191A1C]' : 'text-muted'}`}>{u === 'l100' ? 'L/100 km' : 'km/L'}</Text></Pressable>)}</View></View>
    <Field label={unit === 'l100' ? 'Average consumption (L/100 km)' : 'Average economy (km/L)'} value={efficiency} onChangeText={v => { setEfficiency(v); setSaved(false); }} keyboardType="decimal-pad" placeholder={unit === 'l100' ? 'Example: 6,2' : 'Example: 16,1'} hint="Use your measured average, not an advertised best-case figure." />
    <Field label="Fuel price (DKK/L)" value={price} onChangeText={v => { setPrice(v); setSaved(false); }} keyboardType="decimal-pad" placeholder="Enter your pump price" hint="Manual input. This is not a live fuel-price feed." />
    <View className="mt-2 mb-3"><Eyebrow>TERRAIN-AWARE ESTIMATES</Eyebrow></View>
    <Field label="Car + occupants + luggage (kg)" value={mass} onChangeText={v => { setMass(v); setSaved(false); }} keyboardType="number-pad" placeholder="1150" hint="2018 i20 1.2 MPi is roughly 1055 kg unloaded; 1150 kg is only a starting estimate. Include everyone and luggage." />
    <View className="flex-row gap-2 mb-4">{(['petrol', 'diesel'] as const).map(f => <Pressable key={f} accessibilityRole="button" onPress={() => { setFuelType(f); setSaved(false); }} className={`px-4 py-3 rounded-xl flex-1 items-center ${fuelType === f ? 'bg-accent' : 'bg-panel border border-line'}`}><Text className={fuelType === f ? 'text-[#191A1C] font-semibold' : 'text-muted'}>{f === 'petrol' ? 'Petrol' : 'Diesel'}</Text></Pressable>)}</View>
    <Row icon="trending-up-outline" title="Estimate uphill / downhill effect" subtitle="Experimental. Uses phone GPS vertical accuracy, not engine data. Applies to NEW trips only." trailing={<Switch value={prefs.terrainMode ?? true} onValueChange={v => run(() => savePreferences({ terrainMode: v }))} trackColor={{ false: '#3D4146', true: '#8B522F' }} thumbColor={prefs.terrainMode ? '#FF8735' : '#A3A6AC'} />} />
    <Field label="Monthly driving budget (DKK, optional)" value={budget} onChangeText={v => { setBudget(v); setSaved(false); }} keyboardType="decimal-pad" placeholder="No budget set" />
    <Field label="Your speed alert (km/h, optional)" value={alert} onChangeText={v => { setAlert(v); setSaved(false); }} keyboardType="number-pad" placeholder="Off" hint="A visual threshold you set, not the road's posted speed limit." />
    <Button title={saved ? 'Settings saved' : 'Save settings'} icon={saved ? 'checkmark' : 'checkmark-outline'} onPress={() => run(save)} />
    <Notice>Baseline = distance / 100 × L/100 km × DKK/L. If enabled, reliable hill measurements add a capped, conservative gravity correction. Downhill never means free fuel. Each trip keeps the rates from when it started. {active ? 'Changes apply to your NEXT drive, not the open trip.' : 'Actual fuel consumption cannot be read through the stereo Bluetooth connection.'}</Notice>
    <View className="mt-5"><Eyebrow>DRIVING & PRIVACY</Eyebrow></View>
    <Row icon="phone-portrait-outline" title="Keep display awake" subtitle="While the driving display is open" trailing={<Switch value={prefs.keepAwake} onValueChange={v => run(() => savePreferences({ keepAwake: v }))} trackColor={{ false: '#3D4146', true: '#8B522F' }} thumbColor={prefs.keepAwake ? '#FF8735' : '#A3A6AC'} />} />
    <Row icon="map-outline" title="Save GPS traces" subtitle="On-device only. Applies to new trips." trailing={<Switch value={prefs.recordRoute} onValueChange={v => run(() => savePreferences({ recordRoute: v }))} trackColor={{ false: '#3D4146', true: '#8B522F' }} thumbColor={prefs.recordRoute ? '#FF8735' : '#A3A6AC'} />} />
    <Row icon="moon-outline" title="Screen-off recording" subtitle={prefs.backgroundTracking ? 'Enabled / requires Always allow location' : 'Off / leaving the app pauses your trip'} onPress={() => {
      if (active?.status === 'recording') { run(async () => { throw new Error('Pause your current drive before changing recording mode.'); }); return; }
      if (prefs.backgroundTracking) run(() => savePreferences({ backgroundTracking: false }));
      else confirm('Allow screen-off recording?', 'Android will ask for location access. Choose Allow all the time to record a trip while using Spotify or locking the screen. Tracking runs only during a trip you start, with an ongoing notification. Force-stopping the app stops recording.', enableBackground);
    }} trailing={<Text className="text-accent text-xs">{prefs.backgroundTracking ? 'ON' : 'ENABLE'}</Text>} />
    <Row icon="bluetooth-outline" title="Car audio / Bluetooth" subtitle="Pair your stereo in Android. No OBD adapter needed for this app." onPress={() => run(async () => { if (Platform.OS === 'android') await Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS'); else await Linking.openSettings(); })} />
    <View className="flex-row items-center justify-between mt-8"><Eyebrow>FILL-UP LOG / ACTUAL SPENDING</Eyebrow><Pressable accessibilityRole="button" accessibilityLabel="Add fill-up" onPress={() => setShowFill(true)} className="p-3"><Icon name="add" color="#FF8735" /></Pressable></View>
    {!fuel.length && <Text className="text-muted text-xs leading-5 my-5">Add receipts to track actual pump spending separately from estimates. Two full tanks with odometer readings can calibrate your consumption.</Text>}
    {fuel.slice(0, 8).map(f => <Row key={f.id} icon="water-outline" title={`${number(f.litres, 1)} L / ${money(f.litres * f.pricePerLitre)}`} subtitle={`${dateLabel(f.timestamp)} / ${f.fullTank ? 'Full tank' : 'Partial fill'}`} trailing={<Pressable accessibilityLabel="Delete fill-up" onPress={() => confirm('Delete fill-up?', 'This removes the receipt from local history.', () => deleteFuel(f.id))} className="p-3"><Icon name="trash-outline" size={16} /></Pressable>} />)}
    {calibration !== null && <View className="mt-4"><Button secondary title={`Use measured ${number(calibration, 2)} L/100 km`} onPress={() => run(async () => { await savePreferences({ litresPer100Km: calibration }); setUnit('l100'); setEfficiency(calibration.toFixed(2)); })} /><Text className="text-muted text-[10px] mt-2">Full-to-full estimate including intermediate partial fills.</Text></View>}
    <View className="mt-8"><Eyebrow>PARKING</Eyebrow></View>
    <Row icon="location-outline" title={parking ? 'Your parking spot is saved' : 'Remember where I parked'} subtitle={parking ? dateLabel(parking.timestamp) : 'Save a GPS fix, or finish a drive with a fresh fix'} onPress={() => run(rememberParking)} />
    {parking && <View className="mt-4"><Button secondary title="Open parking spot in Maps" icon="navigate-outline" onPress={() => run(async () => { const q = `${parking.latitude},${parking.longitude}`; await Linking.openURL(Platform.OS === 'android' ? `geo:${q}?q=${q}(Parked%20car)` : `https://maps.google.com/?q=${q}`); })} /><Text className="text-muted text-[10px] mt-2">Opens an external maps app, which may need internet.</Text></View>}
    <View className="mt-8"><Eyebrow>ABOUT THIS BUILD</Eyebrow></View>
    <Notice>No account, analytics, backend or runtime car-asset download. Engine RPM, fuel level and physical door states require a vehicle data interface and are not faked here. Android battery restrictions can interrupt background GPS; a recovered trip is paused rather than filled with invented distance.</Notice>
    <Text className="text-muted text-[11px] leading-5">Vehicle artwork: 2018 Hyundai i20 SE MPi 1.2 Front by Vauxford, CC BY-SA 4.0, via Wikimedia Commons. Background removed and resized. This is a real model-year reference photo, not a 3D asset or a claim about your exact trim.</Text>
    <View className="flex-row gap-5 py-3"><Pressable onPress={() => run(() => Linking.openURL('https://commons.wikimedia.org/wiki/File:2018_Hyundai_i20_SE_MPi_1.2_Front.jpg'))}><Text className="text-accent text-xs">Photo source</Text></Pressable><Pressable onPress={() => run(() => Linking.openURL('https://creativecommons.org/licenses/by-sa/4.0/'))}><Text className="text-accent text-xs">Image licence</Text></Pressable></View>
    <Row icon="trash-outline" title="Clear trip and fill-up history" subtitle="Deletes local logs and parking, not your settings" onPress={() => confirm('Delete local history?', 'All saved trips, traces, fill-ups and parking will be permanently removed. Export your trips first.', eraseHistory)} />
    <Text className="text-muted text-[10px] tracking-[2px] text-center mt-7">TACHYON DRIVE / 0.2 / BUILT TO GO WITH YOU</Text>
    {showFill && <Sheet title="Log a fill-up" onClose={() => setShowFill(false)}>
      <Field label="Litres purchased" value={litres} onChangeText={setLitres} keyboardType="decimal-pad" placeholder="Example: 32,5" />
      <Field label="Price per litre (DKK)" value={fillPrice} onChangeText={setFillPrice} keyboardType="decimal-pad" />
      <Field label="Odometer (km, optional)" value={odo} onChangeText={setOdo} keyboardType="decimal-pad" placeholder="From your dashboard" />
      <View className="flex-row justify-between items-center mb-6"><Text className="text-ink text-sm">Filled to a full tank</Text><Switch value={full} onValueChange={setFull} trackColor={{ false: '#3D4146', true: '#8B522F' }} thumbColor={full ? '#FF8735' : '#A3A6AC'} /></View>
      <Button title="Save receipt" icon="checkmark" onPress={() => run(saveFill)} />
      <Notice>The receipt is logged today. It is not added to trip estimates, and does not automatically change your saved fuel-price setting.</Notice>
    </Sheet>}
  </Screen>;
}
