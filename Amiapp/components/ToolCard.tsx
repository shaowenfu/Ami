import { Pressable, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ChevronRight } from 'lucide-react-native';

import { GeneratedAsset } from '@/components/AppleClay';
import { clay, clayShadow, clayText } from '@/theme/appleClay';
import type { ToolFeature } from '@/store/useAmiMockStore';

const toneBackground: Record<ToolFeature['tone'], string> = {
  lavender: '#F0EAFF',
  rose: '#FFF0F4',
  apricot: '#FFF3E7',
  celadon: '#EFFAF6',
  sky: '#EFF8FE',
  butter: '#FFF8D8',
};

const toneAccent: Record<ToolFeature['tone'], string> = {
  lavender: clay.color.lavenderDeep,
  rose: clay.color.roseDeep,
  apricot: clay.color.apricotDeep,
  celadon: clay.color.celadonDeep,
  sky: clay.color.skyDeep,
  butter: clay.color.butterDeep,
};

export function ToolCard({
  tool,
  icon: Icon,
  onPress,
}: {
  tool: ToolFeature;
  icon: LucideIcon;
  onPress: () => void;
}) {
  const accent = toneAccent[tool.tone];

  return (
    <Pressable
      onPress={onPress}
      className="mb-4 min-h-[210px] w-[48%] overflow-hidden rounded-[32px] px-4 py-4"
      style={({ pressed }) => [
        { backgroundColor: toneBackground[tool.tone], transform: [{ scale: pressed ? 0.965 : 1 }] },
        pressed ? clayShadow.pressed : clayShadow.soft,
      ]}
    >
      <View className="flex-row items-start justify-between">
        <View className="mr-2 flex-1">
          <Text className="text-[23px] leading-7" style={clayText.display}>
            {tool.title}
          </Text>
          <Text className="mt-2 text-[14px] leading-5" style={clayText.body}>
            {tool.subtitle}
          </Text>
        </View>
        <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.72)' }}>
          <Icon color={accent} size={21} strokeWidth={2.7} />
        </View>
      </View>

      <View className="mt-auto flex-row items-end justify-between">
        <View className="max-w-[94px]">
          <Text className="text-[12px] font-extrabold leading-4" style={[clayText.title, { color: accent }]}>
            {tool.stat}
          </Text>
          <View className="mt-3 h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.72)' }}>
            <ChevronRight color={clay.color.ink} size={18} strokeWidth={2.8} />
          </View>
        </View>
        <GeneratedAsset asset={tool.asset} size={78} rounded={24} />
      </View>
    </Pressable>
  );
}
