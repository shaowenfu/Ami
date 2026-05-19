import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarHeart, ListChecks, MapPinned, RotateCcw, SmilePlus, Sparkles } from 'lucide-react-native';

import { CheckPill, ClayButton, ClayInput, ClayModal, ClaySurface, GeneratedAsset, SoftBackground } from '@/components/AppleClay';
import { ToolCard } from '@/components/ToolCard';
import { useAmiMockStore, type ToolId } from '@/store/useAmiMockStore';
import { clay, clayText } from '@/theme/appleClay';

const toolIcons = {
  anniversary: CalendarHeart,
  wishlist: ListChecks,
  mood: SmilePlus,
  date: Sparkles,
  repair: RotateCcw,
  timeline: MapPinned,
} satisfies Record<ToolId, typeof CalendarHeart>;

export default function ToolsScreen() {
  const [wishDraft, setWishDraft] = useState('');
  const {
    tools,
    selectedToolId,
    wishes,
    moods,
    todayMoodId,
    anniversaries,
    datePlan,
    moments,
    repairCount,
    openTool,
    closeTool,
    addWish,
    toggleWish,
    setTodayMood,
    acceptDatePlan,
    saveConflictReflection,
  } = useAmiMockStore();

  const selectedTool = selectedToolId ? tools.find((tool) => tool.id === selectedToolId) : null;

  const submitWish = () => {
    addWish(wishDraft);
    setWishDraft('');
  };

  return (
    <SoftBackground>
      <SafeAreaView className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 116 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-6 mt-7 flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-[42px] leading-[48px]" style={clayText.display}>
                工具箱
              </Text>
              <Text className="mt-3 text-[16px] leading-6" style={clayText.body}>
                把亲密关系里的小事，变成可以一起完成的温柔动作。
              </Text>
            </View>
            <GeneratedAsset asset="ami" size={92} rounded={34} />
          </View>

          <ClaySurface className="mb-5 px-5 py-4" radius={32} tone="clear">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-[15px] font-extrabold" style={[clayText.title, { color: clay.color.lavenderDeep }]}>
                  今日关系状态
                </Text>
                <Text className="mt-2 text-2xl" style={clayText.display}>
                  适合慢慢靠近
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-3xl" style={clayText.display}>
                  {wishes.filter((wish) => !wish.done).length}
                </Text>
                <Text className="text-xs font-bold" style={clayText.body}>
                  个愿望待实现
                </Text>
              </View>
            </View>
          </ClaySurface>

          <View className="flex-row flex-wrap justify-between">
            {tools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} icon={toolIcons[tool.id]} onPress={() => openTool(tool.id)} />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>

      <ClayModal visible={Boolean(selectedTool)} title={selectedTool?.title ?? ''} onClose={closeTool}>
        {selectedTool ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="mb-4 flex-row items-center">
              <GeneratedAsset asset={selectedTool.asset} size={86} rounded={28} />
              <View className="ml-4 flex-1">
                <Text className="text-[18px] leading-6" style={clayText.display}>
                  {selectedTool.subtitle}
                </Text>
                <Text className="mt-2 text-[14px] leading-5" style={clayText.body}>
                  {selectedTool.detail}
                </Text>
              </View>
            </View>

            {selectedTool.id === 'wishlist' ? (
              <View>
                <View className="mb-3 flex-row gap-3">
                  <ClayInput className="flex-1" value={wishDraft} onChangeText={setWishDraft} placeholder="写下一个共同愿望" />
                  <ClayButton onPress={submitWish}>添加</ClayButton>
                </View>
                {wishes.map((wish) => (
                  <Pressable
                    key={wish.id}
                    onPress={() => toggleWish(wish.id)}
                    className="mb-3 flex-row items-center rounded-[24px] px-4 py-4"
                    style={{ backgroundColor: wish.done ? clay.color.celadon : clay.color.card }}
                  >
                    <View
                      className="mr-3 h-7 w-7 items-center justify-center rounded-full"
                      style={{ backgroundColor: wish.done ? clay.color.celadonDeep : clay.color.lavenderSoft }}
                    >
                      <Text className="text-sm font-black" style={{ color: wish.done ? clay.color.white : clay.color.lavenderDeep }}>
                        {wish.done ? '✓' : ''}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-[16px] font-extrabold" style={[clayText.title, wish.done ? { textDecorationLine: 'line-through' } : null]}>
                        {wish.title}
                      </Text>
                      <Text className="mt-1 text-xs font-bold" style={clayText.body}>
                        {wish.owner} 认领
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {selectedTool.id === 'mood' ? (
              <View className="flex-row flex-wrap">
                {moods.map((mood) => (
                  <Pressable
                    key={mood.id}
                    onPress={() => setTodayMood(mood.id)}
                    className="mb-3 mr-3 min-h-[104px] w-[46%] rounded-[26px] px-4 py-4"
                    style={{ backgroundColor: todayMoodId === mood.id ? mood.color : clay.color.card }}
                  >
                    <Text className="text-xl" style={clayText.display}>
                      {mood.label}
                    </Text>
                    <Text className="mt-2 text-[13px] leading-5" style={clayText.body}>
                      {mood.value}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {selectedTool.id === 'anniversary' ? (
              <View>
                {anniversaries.map((item) => (
                  <ClaySurface key={item.id} className="mb-3 px-4 py-4" radius={26} tone="butter">
                    <View className="flex-row items-center justify-between">
                      <View>
                        <Text className="text-[18px]" style={clayText.display}>
                          {item.title}
                        </Text>
                        <Text className="mt-1 text-sm font-bold" style={clayText.body}>
                          {item.date}
                        </Text>
                      </View>
                      <Text className="text-2xl" style={[clayText.display, { color: clay.color.butterDeep }]}>
                        {item.daysLeft} 天
                      </Text>
                    </View>
                  </ClaySurface>
                ))}
              </View>
            ) : null}

            {selectedTool.id === 'date' ? (
              <View>
                {datePlan.items.map((item) => (
                  <View key={item} className="mb-3 rounded-[22px] px-4 py-3" style={{ backgroundColor: clay.color.sky }}>
                    <Text className="text-[15px] font-bold" style={[clayText.body, { color: clay.color.ink }]}>
                      {item}
                    </Text>
                  </View>
                ))}
                <ClayButton onPress={acceptDatePlan} disabled={datePlan.accepted}>
                  {datePlan.accepted ? '计划已确认' : '确认这份计划'}
                </ClayButton>
              </View>
            ) : null}

            {selectedTool.id === 'repair' ? (
              <View>
                {['触发点：我们都希望被优先考虑', '真实需要：不是马上解决，而是先被理解', '下次约定：先暂停十分钟，再回到事实'].map((item) => (
                  <View key={item} className="mb-3 rounded-[22px] px-4 py-3" style={{ backgroundColor: '#FFF0F4' }}>
                    <Text className="text-[15px] leading-6" style={[clayText.body, { color: clay.color.ink }]}>
                      {item}
                    </Text>
                  </View>
                ))}
                <Text className="mb-3 text-sm font-bold" style={clayText.body}>
                  已保存 {repairCount} 次复盘
                </Text>
                <ClayButton onPress={saveConflictReflection}>保存一次复盘</ClayButton>
              </View>
            ) : null}

            {selectedTool.id === 'timeline' ? (
              <View>
                {moments.slice(0, 4).map((moment) => (
                  <ClaySurface key={moment.id} className="mb-3 px-4 py-4" radius={24} tone="clear">
                    <Text className="text-xs font-extrabold" style={[clayText.title, { color: clay.color.lavenderDeep }]}>
                      {moment.day}
                    </Text>
                    <Text className="mt-1 text-[17px]" style={clayText.display}>
                      {moment.title}
                    </Text>
                    <Text className="mt-2 text-[14px] leading-5" style={clayText.body}>
                      {moment.detail}
                    </Text>
                  </ClaySurface>
                ))}
              </View>
            ) : null}

            {selectedTool.id === 'anniversary' || selectedTool.id === 'timeline' ? null : (
              <View className="mt-2 flex-row flex-wrap">
                {['低打扰', '双方可见', 'Ami 会提醒'].map((label, index) => (
                  <CheckPill key={label} active={index === 0} label={label} onPress={() => undefined} />
                ))}
              </View>
            )}
          </ScrollView>
        ) : null}
      </ClayModal>
    </SoftBackground>
  );
}
