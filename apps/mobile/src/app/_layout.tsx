import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{ headerShadowVisible: false, headerTitleStyle: { fontWeight: '700' } }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="results" options={{ headerShown: false }} />
        <Stack.Screen name="stocks/[id]" options={{ title: '기업 상세정보' }} />
        <Stack.Screen name="auth/login" options={{ title: '' }} />
        <Stack.Screen name="auth/register" options={{ title: '' }} />
      </Stack>
    </>
  );
}
