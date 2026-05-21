import { Tabs } from 'expo-router';
import { CalendarCheck, MessageCircleHeart, UserRound, Wrench } from 'lucide-react-native';

import { clay } from '@/theme/appleClay';

const activeColor = clay.color.lavenderDeep;
const inactiveColor = '#7A7384';

export default function SpaceTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          height: 82,
          paddingTop: 10,
          paddingBottom: 14,
          borderTopWidth: 1,
          borderTopColor: 'rgba(231, 223, 237, 0.72)',
          backgroundColor: 'rgba(255, 250, 253, 0.94)',
          position: 'absolute',
          shadowColor: '#B7ADC5',
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.12,
          shadowRadius: 18,
          elevation: 16,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '800',
          fontFamily: clay.font.body,
        },
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          title: '聊天',
          tabBarIcon: ({ color, size }) => <MessageCircleHeart color={color} size={size} strokeWidth={2.5} />,
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: '工具箱',
          tabBarIcon: ({ color, size }) => <Wrench color={color} size={size} strokeWidth={2.5} />,
        }}
      />
      <Tabs.Screen
        name="moments"
        options={{
          title: '时光',
          tabBarIcon: ({ color, size }) => <CalendarCheck color={color} size={size} strokeWidth={2.5} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} strokeWidth={2.5} />,
        }}
      />
    </Tabs>
  );
}

