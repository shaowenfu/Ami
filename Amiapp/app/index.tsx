import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuthStore } from '@/store/useAuthStore';
import { clay } from '@/theme/appleClay';

export default function Index() {
  const status = useAuthStore((state) => state.status);

  if (status === 'checking') {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: clay.color.canvas }}>
        <ActivityIndicator color={clay.color.lavenderDeep} />
      </View>
    );
  }

  return <Redirect href={(status === 'authenticated' ? '/spaces' : '/auth/login') as Href} />;
}
