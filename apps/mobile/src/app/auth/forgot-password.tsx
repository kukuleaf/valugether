import { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, H1, Input, Muted, Page, palette } from '../../components/ui';
import { api } from '../../lib/api';

export default function ForgotPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (submitting) return;
    setError('');
    if (!email.trim()) {
      setError('가입한 이메일을 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await api<{ message: string }>('/auth/password-reset/request', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      Alert.alert('요청 완료', result.message);
      router.replace('/auth/login');
    } catch (error: any) {
      setError(error.message);
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
        <H1>비밀번호 찾기</H1>
        <Muted>이메일/비밀번호 계정에만 재설정 메일을 보냅니다.</Muted>
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
          <Button
            title={submitting ? '요청 중…' : '재설정 메일 받기'}
            disabled={submitting}
            onPress={submit}
          />
          {error ? <Text style={{ color: '#A00000', lineHeight: 21 }}>{error}</Text> : null}
        </Card>
      </Page>
    </ScrollView>
  );
}
