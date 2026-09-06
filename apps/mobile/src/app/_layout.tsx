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
        <Stack.Screen name="results" options={{ title: '검색 결과' }} />
        <Stack.Screen name="auth/login" options={{ title: '로그인' }} />
        <Stack.Screen name="auth/register" options={{ title: '회원가입' }} />
      </Stack>
    </>
  );
}
