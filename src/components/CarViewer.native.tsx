import React, { useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Icon } from '../ui/primitives';
const MODELS = [
  { label: 'i20 Active / 2019', id: 'c1ae84af72d44b9ebda34b718aafbbf2', note: 'Your chosen Sketchfab model. This is a hosted preview; the mesh is not distributed.' },
  { label: 'Hyundai i20 / free', id: '09f69b16a298460f96269d3074a88ea4', note: 'CC BY by 9810264190. Model year is not confirmed; appearance can differ.' },
];
const viewerUrl = (id: string) => 'https://sketchfab.com/models/' + id + '/embed?autostart=1&ui_controls=1&ui_infos=1&ui_watermark=1&ui_hint=0';
export function CarViewer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const model = MODELS[selected];
  return <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
    <SafeAreaView style={{ flex: 1, backgroundColor: '#191A1C' }} edges={['top', 'bottom']}>
      <View className="flex-row items-center justify-between px-5 py-4 border-b border-line">
        <View><Text className="text-muted text-[10px] tracking-[2px]">TACHYON / STUDIO</Text><Text className="text-ink text-xl font-semibold mt-1">Explore the i20</Text></View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close 3D viewer" className="w-11 h-11 items-center justify-center rounded-full border border-line"><Icon name="close" color="#F4F1EA" /></Pressable>
      </View>
      <View className="flex-row gap-2 px-4 py-4">
        {MODELS.map((item, i) => <Pressable key={item.id} onPress={() => { setSelected(i); setError(null); setLoading(true); }} accessibilityRole="button" className={`flex-1 rounded-xl border px-3 py-3 ${selected === i ? 'border-accent bg-[#2F251E]' : 'border-line bg-panel'}`}>
          <Text numberOfLines={1} className={`text-xs font-semibold ${selected === i ? 'text-accent' : 'text-ink'}`}>{item.label}</Text>
        </Pressable>)}
      </View>
      <View className="flex-1 mx-3 mb-3 bg-panel border border-line rounded-xl overflow-hidden">
        {!error ? <WebView
          key={model.id}
          style={{ flex: 1, backgroundColor: '#202226' }}
          source={{ uri: viewerUrl(model.id) }}
          javaScriptEnabled
          domStorageEnabled
          allowsFullscreenVideo
          onLoadStart={() => { setLoading(true); setError(null); }}
          onLoadEnd={() => setLoading(false)}
          onError={event => { setLoading(false); setError(event.nativeEvent.description || 'Unable to load Sketchfab'); }}
          onHttpError={event => { if (event.nativeEvent.statusCode >= 400) setError('Sketchfab returned HTTP ' + event.nativeEvent.statusCode); }}
        /> : <View className="flex-1 items-center justify-center px-8">
          <Icon name="cloud-offline-outline" size={32} color="#FF8735" />
          <Text className="text-ink text-lg mt-4 text-center">3D preview unavailable</Text>
          <Text className="text-muted text-xs leading-5 mt-3 text-center">{error} — the offline car photograph is still available on Home.</Text>
          <Pressable onPress={() => setError(null)} className="bg-accent px-6 py-3 rounded-xl mt-5"><Text className="font-semibold text-[#191A1C]">Retry viewer</Text></Pressable>
        </View>}
        {loading && !error && <View pointerEvents="none" className="absolute top-4 left-4 flex-row gap-2 items-center bg-[#191A1C]/90 px-3 py-2 rounded-xl"><ActivityIndicator size="small" color="#FF8735" /><Text className="text-muted text-xs">Loading 3D model…</Text></View>}
      </View>
      <View className="px-5 pb-5">
        <Text className="text-ink font-semibold text-sm">Rotate with one finger · pinch to zoom</Text>
        <Text className="text-muted text-xs leading-5 mt-2">{model.note}</Text>
        <Text className="text-muted text-[11px] leading-5 mt-2">Requires internet. Sketchfab receives network traffic when this viewer opens. Doors are not animated unless the original 3D model supplies a rig; this does not control your real car.</Text>
        <Pressable onPress={() => void Linking.openURL('https://sketchfab.com/models/' + model.id)} accessibilityRole="button" className="flex-row items-center gap-2 py-3 mt-1"><Text className="text-accent text-xs font-semibold">Open original on Sketchfab</Text><Icon name="open-outline" color="#FF8735" size={15}/></Pressable>
      </View>
    </SafeAreaView>
  </Modal>;
}
