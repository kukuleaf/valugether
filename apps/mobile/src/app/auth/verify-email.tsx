import { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, H1, Input, Muted, Page, palette } from '../../components/ui';
import { api } from '../../lib/api';
import { saveTokens } from '../../lib/session';

export default function VerifyEmail() {
  const params = useLocalSearchParams<{ email?: string; token?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [token, setToken] = useState(params.token ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const confirm = async () => {
    if (submitting) return;
    setMessage('');
    if (!token.trim()) {
      setMessage('메일의 인증 링크를 열거나 인증 토큰을 입력해 주세요.');
      Alert.alert('인증 링크 필요', '메일의 인증 링크를 열거나 인증 토큰을 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const tokens = await api<any>('/auth/email-verification/confirm', {
        method: 'POST',
        body: JSON.stringify({ token: token.trim() }),
      });
      await saveTokens(tokens);
      Alert.alert('인증 완료', '이메일 인증과 로그인이 완료되었습니다.');
      router.replace('/settings');
    } catch (error: any) {
      setMessage(error.message);
      Alert.alert('인증 실패', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (submitting) return;
    setMessage('');
    if (!email.trim()) {
      setMessage('가입한 이메일을 입력해 주세요.');
      Alert.alert('이메일 필요', '가입한 이메일을 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await api<{ message: string }>('/auth/email-verification/request', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setMessage(result.message);
      Alert.alert('요청 완료', result.message);
    } catch (error: any) {
      setMessage(error.message);
      Alert.alert('요청 실패', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      <Page>
        <H1>이메일 인증</H1>
        <Muted>이메일/비밀번호 가입에만 필요합니다. 간편 로그인은 인증 대상이 아닙니다.</Muted>
        <Card>
          <Input
            placeholder="가입한 이메일"
            accessibilityLabel="가입한 이메일"
            autoComplete="email"
            autoCorrect={false}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Button title="인증 메일 다시 받기" disabled={submitting} secondary onPress={resend} />
        </Card>
        <Card>
          <Input
            placeholder="인증 토큰"
            accessibilityLabel="인증 토큰"
            autoCorrect={false}
            autoCapitalize="none"
            value={token}
            onChangeText={setToken}
          />
          <Button title="인증 완료" disabled={submitting} onPress={confirm} />
        </Card>
        {message ? <Text style={{ color: palette.text, lineHeight: 21 }}>{message}</Text> : null}
      </Page>
    </ScrollView>
  );
}
