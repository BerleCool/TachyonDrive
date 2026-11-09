import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { freshSpeed } from './core/trips';
import { initialize, reportError, useStore } from './services/store';
import { restoreRecording, stopPreview, useGPS } from './services/location';
import { Icon, type IconName } from './ui/primitives';
import { Home } from './screens/Home';
import { Drive } from './screens/Drive';
import { Trips } from './screens/Trips';
import { Garage } from './screens/Garage';
const TABS: { id: string; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'car-outline' },
  { id: 'drive', label: 'Drive', icon: 'speedometer-outline' },
  { id: 'trips', label: 'Trips', icon: 'trail-sign-outline' },
  { id: 'garage', label: 'Garage', icon: 'options-outline' },
];
function Awake() { useKeepAwake('tachyon-driving-display'); return null; }
class Boundary extends React.Component<{ children: React.ReactNode }, { message: string | null }> {
  state = { message: null as string | null };
  static getDerivedStateFromError(error: Error) { return { message: error.message }; }
  render() {
    if (this.state.message) return <View style={{ flex: 1, backgroundColor: '#191A1C', padding: 30, justifyContent: 'center' }}><Text style={{ color: '#F4F1EA', fontSize: 22 }}>Tachyon needs a restart.</Text><Text style={{ color: '#A3A6AC', marginTop: 14 }}>Your saved trips remain on this device. {this.state.message}</Text></View>;
    return this.props.children;
  }
}
function Root() {
  const store = useStore();
  const gps = useGPS();
  const [fontsLoaded, fontError] = useFonts(Ionicons.font);
  const [tab, setTab] = useState('home');
  const [focus, setFocus] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [working, setWorking] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    void initialize().then(restoreRecording).catch(e => reportError(String(e)));
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => { if (tab !== 'drive') stopPreview(); }, [tab]);
  const notify = (message: string) => {
    if (Platform.OS === 'web') window.alert(message); else Alert.alert('Tachyon Drive', message);
  };
  const run = useCallback((work: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true; setWorking(true);
    Promise.resolve().then(work).catch(e => notify(e instanceof Error ? e.message : String(e)))
      .finally(() => { pending.current = false; setWorking(false); });
  }, []);
  const confirm = useCallback((title: string, message: string, action: () => Promise<void>) => {
    if (Platform.OS === 'web') { if (window.confirm(title + '\n\n' + message)) run(action); }
    else Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: 'Continue', onPress: () => run(action) }]);
  }, [run]);
  const navigate = (next: string) => {
    const moving = freshSpeed(gps.fix, gps.speed, Date.now());
    if (next === 'garage' && moving !== null && moving > 5) { notify('Please park before editing vehicle settings.'); return; }
    setTab(next); setFocus(false);
  };
  if ((!store.loaded || !fontsLoaded) && !fontError) return <View className="flex-1 bg-canvas items-center justify-center"><ActivityIndicator color="#FF8735" /><Text className="text-muted text-xs mt-4">Opening your garage...</Text></View>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#191A1C' }} edges={['top', 'bottom']}>
    <StatusBar style="light" />
    {tab === 'drive' && store.prefs.keepAwake && <Awake />}
    {!focus && <View className="flex-row items-center justify-between px-[22px] py-4 border-b border-line">
      <View className="flex-row items-center gap-3"><Text className="text-accent text-xl font-black italic">T/</Text><Text className="text-ink text-[12px] font-bold tracking-[2px]">TACHYON <Text className="text-accent">DRIVE</Text></Text></View>
      {working ? <ActivityIndicator color="#FF8735" size="small" /> : <View className="flex-row items-center gap-1.5"><View className={`w-1 h-1 rounded-full ${store.active?.status === 'recording' ? 'bg-accent' : 'bg-muted'}`} /><Text className="text-muted text-[9px] tracking-wider">{store.active?.status === 'recording' ? 'REC' : 'LOCAL'}</Text></View>}
    </View>}
    {store.error && <View className="mx-5 mt-3 px-3 py-2 border-l-2 border-accent flex-row gap-2 items-center"><Text className="flex-1 text-muted text-[11px] leading-4">{store.error}</Text><Pressable onPress={() => reportError(null)} accessibilityLabel="Dismiss notice" className="p-2"><Icon name="close" size={16} /></Pressable></View>}
    <View className="flex-1">
      {tab === 'home' && <Home navigate={navigate} run={run} />}
      {tab === 'drive' && <Drive now={now} run={run} confirm={confirm} focus={focus} setFocus={setFocus} />}
      {tab === 'trips' && <Trips navigate={navigate} run={run} confirm={confirm} />}
      {tab === 'garage' && <Garage run={run} confirm={confirm} />}
    </View>
    {!focus && <View className="flex-row border-t border-line px-3 pt-2 pb-1 bg-canvas">
      {TABS.map(item => <Pressable key={item.id} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: tab === item.id }} onPress={() => navigate(item.id)} className="flex-1 items-center py-3 gap-1.5"><Icon name={item.icon} color={tab === item.id ? '#FF8735' : '#838991'} size={21} /><Text className={`text-[10px] font-medium ${tab === item.id ? 'text-accent' : 'text-muted'}`}>{item.label}</Text><View className={`h-0.5 w-4 rounded-full ${tab === item.id ? 'bg-accent' : 'bg-transparent'}`} /></Pressable>)}
    </View>}
  </SafeAreaView>;
}
export default function App() { return <SafeAreaProvider initialMetrics={initialWindowMetrics}><Boundary><Root /></Boundary></SafeAreaProvider>; }
