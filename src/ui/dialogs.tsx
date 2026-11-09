import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './primitives';
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return <Modal transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View className="flex-1 justify-end bg-black/70">
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close dialog" />
        <View className="bg-canvas rounded-t-3xl border-t border-line" style={{ maxHeight: '88%', paddingBottom: Math.max(insets.bottom, 18) }}>
          <View className="flex-row justify-between items-center px-6 pt-5 pb-3"><Text className="text-ink text-xl font-semibold">{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={onClose} className="w-12 h-12 items-center justify-center"><Icon name="close" /></Pressable></View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 20 }}>{children}</ScrollView>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
