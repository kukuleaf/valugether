import { useState } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, H1, Input, Muted, Page } from '../../components/ui';
import { api } from '../../lib/api';
import { saveTokens } from '../../lib/session';

export default function VerifyEmail() {
  const params = useLocalSearchParams<{ email?: string; token?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [token, setToken] = useState(params.token ?? '');

  const confirm = async () => {
    if (!token) {
      Alert.alert('인증 링크 필요', '메일의 인증 링크를 열거나 인증 토큰을 입력해 주세요.');
      return;
    }
    try {
      const tokens = await api<any>('/auth/email-verification/confirm', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      await saveTokens(tokens);
      Alert.alert('인증 완료', '이메일 인증과 로그인이 완료되었습니다.');
      router.replace('/settings');
    } catch (error: any) {
      Alert.alert('인증 실패', error.message);
    }
  };

  const resend = async () => {
    if (!email) {
      Alert.alert('이메일 필요', '가입한 이메일을 입력해 주세요.');
      return;
    }
    try {
      const result = await api<{ message: string }>('/auth/email-verification/request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      Alert.alert('요청 완료', result.message);
    } catch (error: any) {
      Alert.alert('요청 실패', error.message);
    }
  };

  return (
    <Page>
      <H1>이메일 인증</H1>
      <Muted>이메일/비밀번호 가입에만 필요합니다. 간편 로그인은 인증 대상이 아닙니다.</Muted>
      <Card>
        <Input
          placeholder="가입한 이메일"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Button title="인증 메일 다시 받기" secondary onPress={resend} />
      </Card>
      <Card>
        <Input
          placeholder="인증 토큰"
          autoCapitalize="none"
          value={token}
          onChangeText={setToken}
        />
        <Button title="인증 완료" onPress={confirm} />
      </Card>
    </Page>
  );
}
