import { useState } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, H1, Input, Muted, Page } from '../../components/ui';
import { api } from '../../lib/api';

export default function ForgotPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');

  const submit = async () => {
    try {
      const result = await api<{ message: string }>('/auth/password-reset/request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      Alert.alert('요청 완료', result.message);
      router.replace('/auth/login');
    } catch (error: any) {
      Alert.alert('요청 실패', error.message);
    }
  };

  return (
    <Page>
      <H1>비밀번호 재설정</H1>
      <Muted>이메일/비밀번호 계정에만 재설정 메일을 보냅니다.</Muted>
      <Card>
        <Input
          placeholder="가입한 이메일"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Button title="재설정 메일 받기" onPress={submit} />
      </Card>
    </Page>
  );
}
