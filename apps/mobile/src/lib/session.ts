import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS = 'auth.access';
const REFRESH = 'auth.refresh';

function webStorage() {
  if (typeof globalThis.localStorage === 'undefined') return null;
  return globalThis.localStorage;
}

export async function saveTokens(tokens: { accessToken: string; refreshToken: string }) {
  if (Platform.OS === 'web') {
    const storage = webStorage();
    storage?.setItem(ACCESS, tokens.accessToken);
    storage?.setItem(REFRESH, tokens.refreshToken);
    return;
  }

  await SecureStore.setItemAsync(ACCESS, tokens.accessToken);
  await SecureStore.setItemAsync(REFRESH, tokens.refreshToken);
}

export async function getAccess() {
  if (Platform.OS === 'web') return webStorage()?.getItem(ACCESS) ?? null;
  return SecureStore.getItemAsync(ACCESS);
}

export async function getRefresh() {
  if (Platform.OS === 'web') return webStorage()?.getItem(REFRESH) ?? null;
  return SecureStore.getItemAsync(REFRESH);
}

export async function clearTokens() {
  if (Platform.OS === 'web') {
    const storage = webStorage();
    storage?.removeItem(ACCESS);
    storage?.removeItem(REFRESH);
    return;
  }

  await Promise.all([SecureStore.deleteItemAsync(ACCESS), SecureStore.deleteItemAsync(REFRESH)]);
}
