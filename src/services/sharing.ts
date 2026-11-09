import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { csv, type Trip } from '../core/trips';
export async function exportTrips(trips: Trip[]) {
  const content = csv(trips);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'tachyon-trips.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return;
  }
  if (!FileSystem.cacheDirectory) throw new Error('Export directory is unavailable.');
  const path = FileSystem.cacheDirectory + 'tachyon-trips.csv';
  await FileSystem.writeAsStringAsync(path, content);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export trip summaries (no GPS coordinates)' });
  else await Share.share({ message: content });
}
