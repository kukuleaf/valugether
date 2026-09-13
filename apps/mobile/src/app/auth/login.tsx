import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { saveTokens } from '../../lib/session';
import { Button, Card, H1, Input, Muted, Page, palette } from '../../components/ui';
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const submit = async () => {
    try {
      const tokens = await api<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await saveTokens(tokens);
      Alert.alert('로그인 성공', '안전하게 로그인되었습니다.');
      router.replace('/settings');
    } catch (e: any) {
      Alert.alert('로그인 실패', e.message);
    }
  };
  return (
    <Page>
      <H1>로그인</H1>
      <Card>
        <Input placeholder="이메일" autoCapitalize="none" value={email} onChangeText={setEmail} />
        <Input placeholder="비밀번호" secureTextEntry value={password} onChangeText={setPassword} />
        <Button title="로그인" onPress={submit} />
        <Muted>Google · Kakao · Naver 간편 로그인은 준비 중입니다.</Muted>
      </Card>
      <Text style={{ fontSize: 12, color: palette.muted }}>
        비밀번호는 안전하게 암호화하여 보호합니다.
      </Text>
    </Page>
  );
}
