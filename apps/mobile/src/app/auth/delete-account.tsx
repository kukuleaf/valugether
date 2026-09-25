import { useState } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, H1, Input, Muted, Page } from '../../components/ui';
import { api } from '../../lib/api';
import { clearTokens } from '../../lib/session';

export default function DeleteAccount() {
  const params = useLocalSearchParams<{ hasPassword?: string }>();
  const hasPassword = params.hasPassword !== 'false';
  const [password, setPassword] = useState('');

  const remove = async () => {
    try {
      await api(
        '/auth/me',
        {
          method: 'DELETE',
          body: JSON.stringify({
            confirmation: 'DELETE_MY_ACCOUNT',
            password: hasPassword ? password : undefined,
          }),
        },
        true,
      );
      await clearTokens();
      Alert.alert('탈퇴 완료', '계정과 저장된 사용자 데이터가 삭제되었습니다.');
      router.replace('/settings');
    } catch (error: any) {
      Alert.alert('탈퇴 실패', error.message);
    }
  };

  const confirm = () => {
    if (hasPassword && !password) {
      Alert.alert('비밀번호 필요', '현재 비밀번호를 입력해 주세요.');
      return;
    }
    Alert.alert(
      '정말 탈퇴할까요?',
      '관심기업, 프리셋, 알림과 검색 이력이 즉시 삭제되며 복구할 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        { text: '탈퇴', style: 'destructive', onPress: () => void remove() },
      ],
    );
  };

  return (
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
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Button title="영구 탈퇴" danger onPress={confirm} />
        </Card>
      ) : (
        <Card>
          <Muted>간편 로그인 계정 탈퇴는 provider 재인증 연결 후 제공됩니다.</Muted>
        </Card>
      )}
    </Page>
  );
}
