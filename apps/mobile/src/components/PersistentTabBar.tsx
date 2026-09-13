import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette } from './ui';

const items = [
  { label: '홈', icon: 'home-outline', path: '/' },
  { label: '조건검색', icon: 'options-outline', path: '/advanced' },
  { label: '맞춤기업', icon: 'sparkles-outline', path: '/custom' },
  { label: '관심기업', icon: 'heart-outline', path: '/watchlist' },
  { label: '내 정보', icon: 'person-outline', path: '/settings' },
] as const;

export function PersistentTabBar() {
  return (
    <View style={styles.bar}>
      {items.map((item) => (
        <Pressable
          key={item.path}
          accessibilityRole="button"
          accessibilityLabel={`${item.label} 탭으로 이동`}
          onPress={() => router.navigate(item.path)}
          style={({ pressed }) => [styles.item, pressed && styles.pressed]}
        >
          <Ionicons name={item.icon} size={23} color={palette.muted} />
          <Text style={styles.label}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 66,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: palette.line,
    backgroundColor: 'white',
    paddingTop: 5,
    paddingBottom: 7,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  pressed: { opacity: 0.6 },
  label: { color: palette.muted, fontSize: 10, fontWeight: '600' },
});
