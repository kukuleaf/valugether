import { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, H1, Input, Muted, Page, palette } from '../../components/ui';
import { api } from '../../lib/api';

export default function ResetPassword() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(params.token ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (submitting) return;
    setError('');
    if (!token.trim()) {
      setError('메일의 비밀번호 재설정 링크를 열어 주세요.');
      return;
    }
    if (password.length < 10) {
      setError('비밀번호는 10자 이상이어야 합니다.');
      Alert.alert('비밀번호 확인', '비밀번호는 10자 이상이어야 합니다.');
      return;
    }
    if (password !== confirmPassword) {
      setError('비밀번호가 서로 다릅니다.');
      Alert.alert('비밀번호 확인', '비밀번호가 서로 다릅니다.');
      return;
    }
    setSubmitting(true);
    try {
      await api('/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ token: token.trim(), newPassword: password }),
      });
      Alert.alert('변경 완료', '새 비밀번호로 로그인해 주세요.');
      router.replace('/auth/login');
    } catch (error: any) {
      setError(error.message);
      Alert.alert('변경 실패', error.message);
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
        <H1>새 비밀번호 설정</H1>
        <Muted>메일의 재설정 링크를 통해 들어오면 토큰이 자동 입력됩니다.</Muted>
        <Card>
          <Input
            placeholder="재설정 토큰"
            accessibilityLabel="재설정 토큰"
            autoCorrect={false}
            autoCapitalize="none"
            value={token}
            onChangeText={setToken}
          />
          <Input
            placeholder="새 비밀번호 (10자 이상)"
            accessibilityLabel="새 비밀번호 (10자 이상)"
            autoComplete="new-password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Input
            placeholder="새 비밀번호 확인"
            accessibilityLabel="새 비밀번호 확인"
            autoComplete="new-password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          <Button
            title={submitting ? '변경 중…' : '비밀번호 변경'}
            disabled={submitting}
            onPress={submit}
          />
          {error ? <Text style={{ color: '#A00000', lineHeight: 21 }}>{error}</Text> : null}
        </Card>
      </Page>
    </ScrollView>
  );
}
