import { PropsWithChildren, ReactNode, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  PressableProps,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Check, X, Eye, EyeOff } from 'lucide-react-native';

import { clay, clayShadow, clayText } from '@/theme/appleClay';

const generatedAssets = {
  ami: require('@/assets/generated/ami-mascot.png'),
  couple: require('@/assets/generated/couple-avatar.png'),
  memory: require('@/assets/generated/memory-capsule.png'),
  calendar: require('@/assets/generated/date-calendar.png'),
};

type ClassNameProps = {
  className?: string;
  style?: ViewStyle | ViewStyle[];
};

type ClaySurfaceProps = PropsWithChildren<
  ClassNameProps & {
    onPress?: PressableProps['onPress'];
    tone?: 'card' | 'lavender' | 'rose' | 'apricot' | 'celadon' | 'sky' | 'butter' | 'clear';
    radius?: number;
  }
>;

const toneColor = {
  card: 'rgba(255, 250, 253, 0.92)',
  lavender: clay.color.lavenderSoft,
  rose: '#FFF0F4',
  apricot: '#FFF3E7',
  celadon: '#EFFAF6',
  sky: '#EFF8FE',
  butter: '#FFF7D7',
  clear: 'rgba(255, 250, 253, 0.64)',
};

export function ClaySurface({ children, className = '', style, onPress, tone = 'card', radius = clay.radius.lg }: ClaySurfaceProps) {
  const baseStyle: ViewStyle = {
    backgroundColor: toneColor[tone],
    borderColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderRadius: radius,
    overflow: 'hidden',
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={className}
        style={({ pressed }) => [
          baseStyle,
          pressed ? clayShadow.pressed : clayShadow.soft,
          { transform: [{ scale: pressed ? 0.975 : 1 }] },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View className={className} style={[baseStyle, clayShadow.soft, style]}>
      {children}
    </View>
  );
}

export function SoftBackground({ children }: PropsWithChildren) {
  return (
    <View className="flex-1" style={{ backgroundColor: clay.color.canvas }}>
      <View className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#EDE7FF]" />
      <View className="absolute -right-28 top-20 h-96 w-96 rounded-full bg-[#D7EFE8]" />
      <View className="absolute bottom-24 left-8 h-72 w-72 rounded-full bg-[#FFF0F4]" />
      <View className="absolute bottom-0 right-4 h-56 w-56 rounded-full bg-[#D8ECF8]" />
      {children}
    </View>
  );
}

type ClayButtonProps = PropsWithChildren<{
  onPress?: PressableProps['onPress'];
  variant?: 'primary' | 'secondary' | 'ghost' | 'tonal';
  className?: string;
  disabled?: boolean;
  icon?: ReactNode;
}>;

export function ClayButton({ children, onPress, variant = 'primary', className = '', disabled, icon }: ClayButtonProps) {
  const variantStyle: Record<NonNullable<ClayButtonProps['variant']>, ViewStyle> = {
    primary: { backgroundColor: clay.color.lavender },
    secondary: { backgroundColor: clay.color.card },
    ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: clay.color.line },
    tonal: { backgroundColor: clay.color.lavenderSoft },
  };

  const textColor = variant === 'primary' ? clay.color.white : variant === 'tonal' ? clay.color.lavenderDeep : clay.color.ink;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`min-h-[48px] flex-row items-center justify-center gap-2 rounded-[22px] px-5 ${className}`}
      style={({ pressed }) => [
        variantStyle[variant],
        variant === 'primary' ? clayShadow.button : clayShadow.soft,
        { opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] },
      ]}
    >
      {icon}
      <Text className="text-[15px] font-extrabold" style={[clayText.title, { color: textColor }]}>
        {children}
      </Text>
    </Pressable>
  );
}

export function ClayInput({ className = '', style, secureTextEntry, ...props }: TextInputProps & { className?: string; style?: ViewStyle }) {
  const [isSecure, setIsSecure] = useState(!!secureTextEntry);

  return (
    <View
      className={`min-h-[50px] flex-row items-center rounded-[22px] ${secureTextEntry ? 'pl-4 pr-2' : 'px-4'} ${className}`}
      style={[{ backgroundColor: '#EFE9F5' }, clayShadow.pressed, style]}
    >
      <TextInput
        placeholderTextColor={clay.color.subtle}
        className="flex-1 text-[16px]"
        style={[clayText.body, { color: clay.color.ink, padding: 0 }]}
        secureTextEntry={isSecure}
        {...props}
      />
      {secureTextEntry && (
        <Pressable
          onPress={() => setIsSecure(!isSecure)}
          className="h-10 w-10 items-center justify-center rounded-full"
          style={({ pressed }) => [
            { transform: [{ scale: pressed ? 0.92 : 1 }] }
          ]}
          hitSlop={8}
        >
          {isSecure ? (
            <EyeOff color={clay.color.subtle} size={20} />
          ) : (
            <Eye color={clay.color.lavenderDeep} size={20} />
          )}
        </Pressable>
      )}
    </View>
  );
}

type SegmentOption<T extends string> = {
  label: string;
  value: T;
};

export function ClaySegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row rounded-[26px] p-1" style={{ backgroundColor: 'rgba(239,233,245,0.92)' }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            className="min-h-[46px] flex-1 items-center justify-center rounded-[22px] px-3"
            style={({ pressed }) => [
              active ? { backgroundColor: clay.color.card } : null,
              active ? clayShadow.soft : null,
              { transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            <Text className="text-[14px] font-extrabold" style={[clayText.title, { color: active ? clay.color.ink : clay.color.muted }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ClayModal({
  visible,
  title,
  children,
  onClose,
}: PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
}>) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-[#302D36]/30 px-4 pb-4">
        <ClaySurface className="max-h-[82%] px-5 pb-5 pt-4" radius={34}>
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-2xl font-black" style={clayText.display}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              className="h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: clay.color.lavenderSoft }}
            >
              <X color={clay.color.ink} size={20} strokeWidth={2.6} />
            </Pressable>
          </View>
          {children}
        </ClaySurface>
      </View>
    </Modal>
  );
}

export function RelationshipAvatar({
  asset = 'couple',
  size = 64,
  label,
}: {
  asset?: 'ami' | 'couple' | 'memory' | 'calendar';
  size?: number;
  label?: string;
}) {
  return (
    <View className="items-center">
      <View
        className="overflow-hidden rounded-full"
        style={[{ width: size, height: size, backgroundColor: clay.color.card }, clayShadow.soft]}
      >
        <Image source={generatedAssets[asset]} style={{ width: size, height: size }} resizeMode="cover" />
      </View>
      {label ? (
        <Text className="mt-2 text-xs font-bold" style={[clayText.body, { color: clay.color.muted }]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

export function GeneratedAsset({
  asset,
  size,
  rounded = clay.radius.lg,
}: {
  asset: 'ami' | 'couple' | 'memory' | 'calendar';
  size: number;
  rounded?: number;
}) {
  return (
    <View className="overflow-hidden" style={{ width: size, height: size, borderRadius: rounded, backgroundColor: clay.color.canvas }}>
      <Image source={generatedAssets[asset]} style={{ width: size, height: size }} resizeMode="cover" />
    </View>
  );
}

export function CheckPill({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="mr-2 mt-2 min-h-[38px] flex-row items-center rounded-full px-4"
      style={({ pressed }) => [
        { backgroundColor: active ? clay.color.lavenderSoft : clay.color.card, borderWidth: active ? 1 : 0, borderColor: active ? clay.color.lavender : 'transparent' },
        active ? clayShadow.button : clayShadow.soft,
        { transform: [{ scale: pressed ? 0.95 : 1 }] },
      ]}
    >
      {active ? <Check color={clay.color.lavenderDeep} size={15} strokeWidth={3} /> : null}
      <Text className={`${active ? 'ml-1' : ''} text-sm font-extrabold`} style={[clayText.title, { color: active ? clay.color.lavenderDeep : clay.color.ink }]}>
        {label}
      </Text>
    </Pressable>
  );
}
