import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewProps,
} from 'react-native';

export const palette = {
  bg: '#F3F7F8',
  surface: '#FFFFFF',
  text: '#162A3A',
  muted: '#667984',
  line: '#DFE8EA',
  accent: '#176B87',
  brand: '#1FA987',
  near: '#9A6200',
};
function withoutEmptyText(children: React.ReactNode) {
  return React.Children.toArray(children).filter((child) => child !== '');
}
export function Page({ children, style, ...props }: ViewProps) {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const hasNativeHeader = segments[0] !== '(tabs)' && segments[0] !== 'results';
  return (
    <View
      {...props}
      style={[
        styles.page,
        Platform.OS !== 'web' && {
          paddingTop: hasNativeHeader ? 20 : Math.max(20, insets.top + 10),
          paddingBottom: Math.max(20, insets.bottom + 10),
        },
        style,
      ]}
    >
      {withoutEmptyText(children)}
    </View>
  );
}
export function Card({ children, style, ...props }: ViewProps) {
  return (
    <View {...props} style={[styles.card, style]}>
      {withoutEmptyText(children)}
    </View>
  );
}
export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}
export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}
export function Button({
  title,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        danger && styles.buttonDanger,
        disabled && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          secondary && { color: palette.text },
          danger && styles.buttonDangerText,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function LoadingState({ label = '불러오는 중이에요' }: { label?: string }) {
  const pulse = React.useRef(new Animated.Value(0.75)).current;
  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse, {
          toValue: 0.75,
          duration: 650,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);
  return (
    <View accessibilityRole="progressbar" style={styles.loading}>
      <Animated.View
        style={[styles.loadingIcon, { opacity: pulse, transform: [{ scale: pulse }] }]}
      >
        <Ionicons name="analytics" size={25} color="white" />
      </Animated.View>
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}
export function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={palette.muted}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}
const styles = StyleSheet.create({
  page: {
    flex: 1,
    width: Platform.OS === 'web' ? ('calc(100% - 40px)' as any) : '100%',
    maxWidth: 720,
    minWidth: 0,
    alignSelf: 'center',
    backgroundColor: palette.bg,
    padding: Platform.OS === 'web' ? 0 : 20,
    gap: 14,
  },
  card: {
    width: Platform.OS === 'web' ? 'auto' : '100%',
    alignSelf: 'stretch',
    minWidth: 0,
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 6,
    ...Platform.select({
      web: { boxShadow: '0 5px 16px rgba(20,48,68,0.07)' },
      default: {
        shadowColor: '#143044',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },
        elevation: 2,
      },
    }),
  },
  h1: { fontSize: 26, fontWeight: '700', color: palette.text, letterSpacing: -0.5 },
  muted: { fontSize: 14, color: palette.muted, lineHeight: 20 },
  button: {
    height: 48,
    borderRadius: 12,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(23,107,135,0.18)' },
      default: {
        shadowColor: '#176B87',
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      },
    }),
  },
  buttonSecondary: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  buttonDanger: { backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#D94C4C' },
  buttonDangerText: { color: '#B42318' },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 15 },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    paddingHorizontal: 14,
    color: palette.text,
    fontSize: 15,
  },
  loading: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 28 },
  loadingIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.brand,
  },
  loadingText: { color: palette.muted, fontSize: 14, fontWeight: '600' },
});
