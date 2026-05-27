import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock3 } from 'lucide-react-native';

import { ClaySurface, SoftBackground } from '@/components/AppleClay';
import { clay, clayText } from '@/theme/appleClay';

export default function SpaceMomentsScreen() {
  return (
    <SoftBackground>
      <SafeAreaView className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 116 }} showsVerticalScrollIndicator={false}>
          <View className="mt-7">
            <Text className="text-[42px] leading-[48px]" style={clayText.display}>
              时光
            </Text>
            <Text className="mt-3 text-[16px] leading-6" style={clayText.body}>
              当前空间还没有真实沉淀的共同记录。
            </Text>
          </View>

          <ClaySurface className="mt-8 items-center px-6 py-10" radius={34}>
            <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: clay.color.celadon }}>
              <Clock3 color={clay.color.celadonDeep} size={28} strokeWidth={2.5} />
            </View>
            <Text className="mt-5 text-xl" style={clayText.display}>
              暂无真实时光记录
            </Text>
            <Text className="mt-2 text-center text-[15px] leading-6" style={clayText.body}>
              这里不会再展示模拟内容；等后端提供真实记录后再同步呈现。
            </Text>
          </ClaySurface>
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}
