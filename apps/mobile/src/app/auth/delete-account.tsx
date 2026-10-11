import { useState } from 'react';
import { Alert, Modal, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, H1, Input, Muted, Page, palette } from '../../components/ui';
import { api } from '../../lib/api';
import { clearTokens } from '../../lib/session';
import { kakaoLogin, kakaoLogout } from '../../lib/kakao';
import { isNaverLoginAvailable, naverLogin, naverLogout } from '../../lib/naver';

export default function DeleteAccount() {
  const params = useLocalSearchParams<{ hasPassword?: string; socialProvider?: string }>();
  const hasPassword = params.hasPassword !== 'false';
  const [password, setPassword] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');

  const remove = async () => {
    if (removing) return;
    setRemoving(true);
    setConfirmOpen(false);
    setError('');
    try {
      let providerProof:
        | { kakaoIdToken: string; kakaoAccessToken: string; kakaoNonce: string }
        | { naverRefreshToken: string }
        | undefined;
      if (!hasPassword && params.socialProvider === 'KAKAO') {
        const { nonce } = await api<{ nonce: string }>('/auth/kakao/nonce', { method: 'POST' });
        const proof = await kakaoLogin(nonce, true);
        providerProof = {
          kakaoIdToken: proof.idToken,
          kakaoAccessToken: proof.accessToken,
          kakaoNonce: nonce,
        };
      }
      if (!hasPassword && params.socialProvider === 'NAVER') {
        const proof = await naverLogin(true);
        providerProof = { naverRefreshToken: proof.refreshToken };
      }
      const result = await api<{ providerDisconnectPending?: boolean }>(
        '/auth/me',
        {
          method: 'DELETE',
          body: JSON.stringify({
            confirmation: 'DELETE_MY_ACCOUNT',
            password: hasPassword ? password : undefined,
            ...providerProof,
          }),
        },
        true,
      );
      await clearTokens();
      if (params.socialProvider === 'NAVER') await naverLogout().catch(() => undefined);
      if (params.socialProvider === 'KAKAO') await kakaoLogout().catch(() => undefined);
      Alert.alert(
        '탈퇴 완료',
        result.providerDisconnectPending
          ? '계정과 저장된 데이터가 삭제되었습니다. 네이버 연결 해제가 지연되어 네이버의 연결된 서비스에서 직접 해제해 주세요.'
          : '계정과 저장된 사용자 데이터가 삭제되었습니다.',
      );
      router.replace({
        pathname: '/settings',
        params: {
          naverDisconnectPending: result.providerDisconnectPending ? 'true' : undefined,
        },
      });
    } catch (error: any) {
      setError(error.message);
      Alert.alert('탈퇴 실패', error.message);
    } finally {
      setRemoving(false);
    }
  };

  const confirm = () => {
    if (removing) return;
    if (hasPassword && !password) {
      setError('현재 비밀번호를 입력해 주세요.');
      Alert.alert('비밀번호 필요', '현재 비밀번호를 입력해 주세요.');
      return;
    }
    setConfirmOpen(true);
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      <Page>
        <H1>회원 탈퇴</H1>
        <Card>
          <Muted>
            계정, 인증수단, 관심기업, 프리셋, 알림, 검색 이력이 삭제됩니다. 비식별화된 운영 감사
            기록만 정책 기간 동안 보존됩니다.
          </Muted>
        </Card>
        {hasPassword ? (
          <Card>
            <Input
              placeholder="현재 비밀번호"
              accessibilityLabel="현재 비밀번호"
              autoComplete="current-password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <Button
              title={removing ? '탈퇴 중…' : '영구 탈퇴'}
              disabled={removing}
              danger
              onPress={confirm}
            />
          </Card>
        ) : (
          <Card>
            {params.socialProvider === 'KAKAO' ? (
              <>
                <Muted>카카오 계정으로 다시 인증한 뒤 연결을 해제하고 탈퇴합니다.</Muted>
                <Button
                  title={removing ? '탈퇴 중…' : '카카오 재인증 후 영구 탈퇴'}
                  disabled={removing}
                  danger
                  onPress={confirm}
                />
              </>
            ) : params.socialProvider === 'NAVER' ? (
              <>
                <Muted>네이버 계정으로 다시 인증한 뒤 연결을 해제하고 탈퇴합니다.</Muted>
                {!isNaverLoginAvailable() && (
                  <Muted>네이버로 가입한 Android 앱에서 탈퇴할 수 있습니다.</Muted>
                )}
                <Button
                  title={removing ? '탈퇴 중…' : '네이버 재인증 후 영구 탈퇴'}
                  disabled={removing || !isNaverLoginAvailable()}
                  danger
                  onPress={confirm}
                />
              </>
            ) : (
              <Muted>이 간편 로그인 계정의 탈퇴 기능은 아직 준비 중입니다.</Muted>
            )}
          </Card>
        )}
        {error ? <Text style={{ color: '#A00000', lineHeight: 21 }}>{error}</Text> : null}
      </Page>
      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmOpen(false)}
      >
        <View
          style={{
            flex: 1,
            padding: 20,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.35)',
          }}
        >
          <Card style={{ width: '100%', maxWidth: 440 }}>
            <H1>정말 탈퇴할까요?</H1>
            <Muted>관심기업, 프리셋, 알림과 검색 이력이 즉시 삭제되며 복구할 수 없습니다.</Muted>
            <Button title="탈퇴" danger onPress={() => void remove()} />
            <Button title="취소" secondary onPress={() => setConfirmOpen(false)} />
          </Card>
        </View>
      </Modal>
    </ScrollView>
  );
}
