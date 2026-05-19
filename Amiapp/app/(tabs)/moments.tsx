import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bookmark, Clock3, HeartHandshake, Sparkles } from 'lucide-react-native';

import { CheckPill, ClaySurface, GeneratedAsset, SoftBackground } from '@/components/AppleClay';
import { useAmiMockStore, type MomentType } from '@/store/useAmiMockStore';
import { clay, clayText } from '@/theme/appleClay';

const filters: { label: string; value: MomentType }[] = [
  { label: '全部', value: 'all' },
  { label: '约会', value: 'date' },
  { label: '愿望', value: 'wish' },
  { label: '复盘', value: 'repair' },
  { label: '回忆', value: 'memory' },
];

export default function MomentsScreen() {
  const { moments, momentFilter, setMomentFilter, toggleMomentSaved } = useAmiMockStore();
  const visibleMoments = momentFilter === 'all' ? moments : moments.filter((moment) => moment.type === momentFilter);

  return (
    <SoftBackground>
      <SafeAreaView className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 116 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-5 mt-7 flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-[42px] leading-[48px]" style={clayText.display}>
                时光
              </Text>
              <Text className="mt-3 text-[16px] leading-6" style={clayText.body}>
                关系不是一次完成的，它由很多被认真保存的瞬间组成。
              </Text>
            </View>
            <GeneratedAsset asset="memory" size={92} rounded={34} />
          </View>

          <ClaySurface className="mb-5 px-5 py-5" radius={34}>
            <View className="flex-row items-start">
              <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: clay.color.lavenderSoft }}>
                <HeartHandshake color={clay.color.lavenderDeep} size={24} strokeWidth={2.5} />
              </View>
              <View className="ml-4 flex-1">
                <Text className="text-xs font-extrabold" style={[clayText.title, { color: clay.color.lavenderDeep }]}>
                  本月关系关键词
                </Text>
                <Text className="mt-2 text-[28px] leading-9" style={clayText.display}>
                  重新靠近
                </Text>
                <Text className="mt-2 text-[15px] leading-6" style={clayText.body}>
                  你们开始把约会、表达和复盘变成共同维护关系的小习惯。
                </Text>
              </View>
            </View>
          </ClaySurface>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            {filters.map((filter) => (
              <CheckPill
                key={filter.value}
                active={momentFilter === filter.value}
                label={filter.label}
                onPress={() => setMomentFilter(filter.value)}
              />
            ))}
          </ScrollView>

          <View>
            {visibleMoments.map((moment, index) => (
              <ClaySurface key={moment.id} className="mb-4 px-5 py-5" radius={30} tone={index % 2 === 0 ? 'card' : 'clear'}>
                <View className="flex-row">
                  <View className="mr-4 items-center">
                    <View className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: clay.color.lavenderSoft }}>
                      {moment.type === 'date' ? (
                        <Sparkles color={clay.color.lavenderDeep} size={21} />
                      ) : (
                        <Clock3 color={clay.color.lavenderDeep} size={21} />
                      )}
                    </View>
                    <View className="mt-2 h-16 w-[2px] rounded-full" style={{ backgroundColor: clay.color.line }} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 pr-3">
                        <Text className="text-xs font-extrabold" style={[clayText.title, { color: clay.color.lavenderDeep }]}>
                          {moment.day}
                        </Text>
                        <Text className="mt-1 text-[21px] leading-7" style={clayText.display}>
                          {moment.title}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => toggleMomentSaved(moment.id)}
                        className="h-10 w-10 items-center justify-center rounded-full"
                        style={{ backgroundColor: moment.saved ? '#FFF0F4' : clay.color.lavenderSoft }}
                      >
                        <Bookmark
                          color={moment.saved ? clay.color.roseDeep : clay.color.lavenderDeep}
                          fill={moment.saved ? clay.color.roseDeep : 'transparent'}
                          size={19}
                        />
                      </Pressable>
                    </View>
                    <Text className="mt-3 text-[15px] leading-6" style={clayText.body}>
                      {moment.detail}
                    </Text>
                  </View>
                </View>
              </ClaySurface>
            ))}

            {visibleMoments.length === 0 ? (
              <ClaySurface className="items-center px-6 py-8" radius={30}>
                <GeneratedAsset asset="ami" size={86} rounded={30} />
                <Text className="mt-4 text-xl" style={clayText.display}>
                  暂时没有这一类瞬间
                </Text>
                <Text className="mt-2 text-center text-[15px] leading-6" style={clayText.body}>
                  等你们下一次行动，Ami 会把它温柔地放进这里。
                </Text>
              </ClaySurface>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}
