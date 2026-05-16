import { View, Text } from 'react-native';

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <View className="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-sm">
        <Text className="text-center text-2xl font-bold text-foreground">
          Ami
        </Text>
        <Text className="mt-2 text-center text-base text-muted-foreground">
          你的 AI 伙伴
        </Text>
        <View className="mt-6 h-px bg-border" />
        <Text className="mt-4 text-center text-sm text-muted">
          React Native + Expo + NativeWind
        </Text>
      </View>
    </View>
  );
}
