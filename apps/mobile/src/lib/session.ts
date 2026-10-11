import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS = 'auth.access';
const REFRESH = 'auth.refresh';
let pendingMutation: Promise<unknown> = Promise.resolve();

function webStorage() {
  if (typeof globalThis.localStorage === 'undefined') return null;
  return globalThis.localStorage;
}

function mutateTokens<T>(operation: () => Promise<T>) {
  const mutation = pendingMutation.then(operation, operation);
  pendingMutation = mutation.catch(() => undefined);
  return mutation;
}

export function saveTokens(
  tokens: { accessToken: string; refreshToken: string },
  expectedRefresh?: string,
) {
  return mutateTokens(async () => {
    if (expectedRefresh !== undefined) {
      const current =
        Platform.OS === 'web'
          ? (webStorage()?.getItem(REFRESH) ?? null)
          : await SecureStore.getItemAsync(REFRESH);
      if (current !== expectedRefresh) return false;
    }
    if (Platform.OS === 'web') {
      const storage = webStorage();
      storage?.setItem(ACCESS, tokens.accessToken);
      storage?.setItem(REFRESH, tokens.refreshToken);
    } else {
      await SecureStore.setItemAsync(ACCESS, tokens.accessToken);
      await SecureStore.setItemAsync(REFRESH, tokens.refreshToken);
    }
    return true;
  });
}

export async function getAccess() {
  await pendingMutation;
  if (Platform.OS === 'web') return webStorage()?.getItem(ACCESS) ?? null;
  return SecureStore.getItemAsync(ACCESS);
}

export async function getRefresh() {
  await pendingMutation;
  if (Platform.OS === 'web') return webStorage()?.getItem(REFRESH) ?? null;
  return SecureStore.getItemAsync(REFRESH);
}

export function clearTokens(expectedRefresh?: string | null) {
  return mutateTokens(async () => {
    if (expectedRefresh !== undefined) {
      const current =
        Platform.OS === 'web'
          ? (webStorage()?.getItem(REFRESH) ?? null)
          : await SecureStore.getItemAsync(REFRESH);
      if (current !== expectedRefresh) return;
    }
    if (Platform.OS === 'web') {
      const storage = webStorage();
      storage?.removeItem(ACCESS);
      storage?.removeItem(REFRESH);
      return;
    }
    await Promise.all([SecureStore.deleteItemAsync(ACCESS), SecureStore.deleteItemAsync(REFRESH)]);
  });
}
