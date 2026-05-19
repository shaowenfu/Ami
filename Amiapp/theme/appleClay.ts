import { Platform, TextStyle, ViewStyle } from 'react-native';

export const clay = {
  color: {
    canvas: '#F6F3FB',
    canvasDeep: '#EEE7F6',
    card: '#FFFAFD',
    cardWarm: '#FFF7F1',
    ink: '#302D36',
    muted: '#625D69',
    subtle: '#8C8496',
    line: '#E7DFED',
    lavender: '#8F7CF4',
    lavenderDeep: '#6F5DD7',
    lavenderSoft: '#EDE7FF',
    rose: '#EEC9D3',
    roseDeep: '#CF718A',
    apricot: '#F7D7B7',
    apricotDeep: '#E9A766',
    celadon: '#D7EFE8',
    celadonDeep: '#5FAF98',
    sky: '#D8ECF8',
    skyDeep: '#5D9ECB',
    butter: '#F8E9AE',
    butterDeep: '#D2A33F',
    white: '#FFFFFF',
  },
  radius: {
    sm: 18,
    md: 24,
    lg: 32,
    xl: 42,
    pill: 999,
  },
  font: {
    display: Platform.select({ web: 'Nunito, DM Sans, sans-serif', default: 'System' }),
    body: Platform.select({ web: 'DM Sans, sans-serif', default: 'System' }),
  },
};

export const clayText = {
  display: {
    fontFamily: clay.font.display,
    fontWeight: '900',
    color: clay.color.ink,
  } as TextStyle,
  title: {
    fontFamily: clay.font.display,
    fontWeight: '800',
    color: clay.color.ink,
  } as TextStyle,
  body: {
    fontFamily: clay.font.body,
    color: clay.color.muted,
  } as TextStyle,
};

export const clayShadow = {
  surface: {
    shadowColor: '#B3A9C4',
    shadowOffset: { width: 16, height: 18 },
    shadowOpacity: 0.23,
    shadowRadius: 30,
    elevation: 8,
  } as ViewStyle,
  soft: {
    shadowColor: '#B7ADC5',
    shadowOffset: { width: 10, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 5,
  } as ViewStyle,
  button: {
    shadowColor: '#8F7CF4',
    shadowOffset: { width: 8, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 6,
  } as ViewStyle,
  pressed: {
    shadowColor: '#CFC5DD',
    shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 1,
  } as ViewStyle,
};
