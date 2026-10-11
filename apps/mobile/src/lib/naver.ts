import Constants from 'expo-constants';
import { Platform } from 'react-native';

type NativeNaverLogin = {
  login(reauthenticate: boolean): Promise<{ accessToken: string; refreshToken: string }>;
  logout(): Promise<void>;
};

export function isNaverLoginAvailable() {
  return (
    Platform.OS === 'android' &&
    Constants.executionEnvironment !== 'storeClient' &&
    Constants.expoConfig?.extra?.naverEnabled === true
  );
}

async function sdk() {
  if (Platform.OS !== 'android')
    throw new Error('네이버 로그인은 Android 앱에서 사용할 수 있습니다.');
  if (Constants.executionEnvironment === 'storeClient') {
    throw new Error('네이버 로그인은 설치한 Android 앱에서 사용할 수 있습니다.');
  }
  if (!isNaverLoginAvailable()) throw new Error('네이버 로그인은 현재 준비 중입니다.');
  try {
    const { requireNativeModule } = await import('expo');
    return requireNativeModule<NativeNaverLogin>('ValugetherNaverLogin');
  } catch {
    throw new Error('네이버 로그인 기능이 포함된 최신 Android 앱을 설치해 주세요.');
  }
}

export async function naverLogin(reauthenticate = false) {
  const naver = await sdk();
  let proof: { accessToken: string; refreshToken: string };
  try {
    proof = await naver.login(reauthenticate);
  } catch (error) {
    const code = error != null && typeof error === 'object' && 'code' in error ? error.code : null;
    throw new Error(
      code === 'E_NAVER_CANCELLED'
        ? '네이버 로그인을 취소했습니다.'
        : '네이버 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  if (
    typeof proof?.accessToken !== 'string' ||
    !proof.accessToken.trim() ||
    typeof proof.refreshToken !== 'string' ||
    !proof.refreshToken.trim()
  ) {
    throw new Error('네이버 로그인 정보를 받지 못했습니다. 다시 시도해 주세요.');
  }
  return { accessToken: proof.accessToken, refreshToken: proof.refreshToken };
}

export async function naverLogout() {
  const naver = await sdk();
  await naver.logout();
}
