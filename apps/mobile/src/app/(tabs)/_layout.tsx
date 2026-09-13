import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { palette } from '../../components/ui';
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerShadowVisible: false,
        tabBarLabelStyle: { fontSize: 10 },
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: '#86959D',
        tabBarItemStyle: { minWidth: 0, paddingHorizontal: 0 },
        tabBarStyle: {
          height: 66,
          paddingTop: 5,
          paddingBottom: 7,
          borderTopColor: palette.line,
          backgroundColor: 'white',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="advanced"
        options={{
          title: '조건검색',
          tabBarIcon: ({ color, size }) => <Ionicons name="options" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="custom"
        options={{
          title: '맞춤기업',
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: '관심기업',
          tabBarIcon: ({ color, size }) => <Ionicons name="heart" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '내 정보',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
