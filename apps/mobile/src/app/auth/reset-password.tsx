import { useState } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, H1, Input, Muted, Page } from '../../components/ui';
import { api } from '../../lib/api';

export default function ResetPassword() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(params.token ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const submit = async () => {
    if (password.length < 10) {
      Alert.alert('비밀번호 확인', '비밀번호는 10자 이상이어야 합니다.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('비밀번호 확인', '비밀번호가 서로 다릅니다.');
      return;
    }
    try {
      await api('/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: password }),
      });
      Alert.alert('변경 완료', '새 비밀번호로 로그인해 주세요.');
      router.replace('/auth/login');
    } catch (error: any) {
      Alert.alert('변경 실패', error.message);
    }
  };

  return (
    <Page>
      <H1>새 비밀번호 설정</H1>
      <Muted>메일의 재설정 링크를 통해 들어오면 토큰이 자동 입력됩니다.</Muted>
      <Card>
        <Input
          placeholder="재설정 토큰"
          autoCapitalize="none"
          value={token}
          onChangeText={setToken}
        />
        <Input
          placeholder="새 비밀번호 (10자 이상)"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Input
          placeholder="새 비밀번호 확인"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <Button title="비밀번호 변경" onPress={submit} />
      </Card>
    </Page>
  );
}
