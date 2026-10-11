import { Platform } from 'react-native';

export type KakaoProof = { idToken: string; accessToken: string };

async function sdk() {
  if (Platform.OS !== 'android') throw new Error('카카오 로그인은 Android 앱에서만 지원합니다.');
  if (!process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY?.trim()) {
    throw new Error('카카오 앱 키가 빌드에 설정되지 않았습니다.');
  }
  return import('@react-native-seoul/kakao-login');
}

export async function kakaoLogin(nonce: string, reauthenticate = false): Promise<KakaoProof> {
  const kakao = await sdk();
  const token = reauthenticate
    ? await kakao.loginWithKakaoAccount({ nonce })
    : await kakao.login({ nonce });
  if (!token.idToken || !token.accessToken) {
    throw new Error('카카오 ID 토큰을 받지 못했습니다. OpenID Connect 설정을 확인해 주세요.');
  }
  return { idToken: token.idToken, accessToken: token.accessToken };
}

export async function kakaoLogout() {
  const kakao = await sdk();
  await kakao.logout();
}
