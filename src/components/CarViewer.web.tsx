import React from 'react';
import { Linking, Modal, Pressable, Text, View } from 'react-native';
import { Icon } from '../ui/primitives';
/** Web preview: no native WebView; the hosted model opens in a browser tab. */
export function CarViewer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return <Modal visible={visible} onRequestClose={onClose} animationType="fade" transparent>
    <View className="flex-1 bg-black/90 items-center justify-center px-6">
      <View className="bg-panel rounded-2xl p-7 w-full max-w-sm border border-line">
        <Text className="text-ink text-xl font-semibold">3D Hyundai i20</Text>
        <Text className="text-muted text-sm leading-6 mt-3">The Android app opens a touch-controlled Sketchfab 3D viewer. In this web preview, open the same model in a browser tab instead.</Text>
        <Pressable onPress={() => void Linking.openURL('https://sketchfab.com/models/c1ae84af72d44b9ebda34b718aafbbf2')} className="bg-accent rounded-xl items-center p-4 mt-5"><Text className="font-semibold text-[#191A1C]">View i20 Active 2019 in 3D</Text></Pressable>
        <Pressable onPress={onClose} className="flex-row justify-center items-center gap-2 mt-5 py-2"><Icon name="close" size={16}/><Text className="text-muted">Close</Text></Pressable>
      </View>
    </View>
  </Modal>;
}
