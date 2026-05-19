import { Stack } from 'expo-router';
import { View } from 'react-native';
import '../styles/global.css';

import { clay, clayShadow } from '@/theme/appleClay';

export default function RootLayout() {
  return (
    <View className="flex-1 items-center" style={{ backgroundColor: clay.color.canvasDeep }}>
      <View
        className="flex-1 overflow-hidden"
        style={[{ width: '100%', maxWidth: 480, backgroundColor: clay.color.canvas }, clayShadow.surface]}
      >
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </View>
  );
}
