import { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { saveTokens } from '../../lib/session';
import { Button, Card, H1, Input, Muted, Page, palette } from '../../components/ui';
import { kakaoLogin, KakaoProof } from '../../lib/kakao';

type Tokens = { accessToken: string; refreshToken: string };
type KakaoResponse = Tokens | { consentRequired: true };
type Term = {
  term_id: number;
  title: string;
  version: string;
  content: string;
  is_required: boolean;
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [kakaoBusy, setKakaoBusy] = useState(false);
  const [kakaoProof, setKakaoProof] = useState<(KakaoProof & { nonce: string }) | null>(null);
  const [terms, setTerms] = useState<Term[]>([]);
  const [agreed, setAgreed] = useState<Record<number, boolean>>({});
  const [expandedTerm, setExpandedTerm] = useState<number | null>(null);

  const finishLogin = async (tokens: Tokens) => {
    await saveTokens(tokens);
    router.replace('/settings');
  };

  const submit = async () => {
    try {
      const tokens = await api<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await finishLogin(tokens);
      Alert.alert('로그인 성공', '안전하게 로그인되었습니다.');
    } catch (e: any) {
      Alert.alert('로그인 실패', e.message);
    }
  };

  const startKakao = async () => {
    if (kakaoBusy) return;
    setKakaoBusy(true);
    try {
      const { nonce } = await api<{ nonce: string }>('/auth/kakao/nonce', { method: 'POST' });
      const proof = await kakaoLogin(nonce);
      const result = await api<KakaoResponse>('/auth/kakao/login', {
        method: 'POST',
        body: JSON.stringify({ idToken: proof.idToken, nonce }),
      });
      if ('consentRequired' in result) {
        const activeTerms = await api<Term[]>('/terms/active');
        setTerms(activeTerms);
        setAgreed({});
        setKakaoProof({ ...proof, nonce });
      } else {
        await finishLogin(result);
      }
    } catch (error: any) {
      Alert.alert('카카오 로그인 실패', error.message ?? String(error));
    } finally {
      setKakaoBusy(false);
    }
  };

  const completeKakaoSignup = async () => {
    if (!kakaoProof || kakaoBusy) return;
    if (terms.some((term) => term.is_required && !agreed[term.term_id])) {
      Alert.alert('필수 동의 필요', '필수 약관에 동의해 주세요.');
      return;
    }
    setKakaoBusy(true);
    try {
      const result = await api<KakaoResponse>('/auth/kakao/login', {
        method: 'POST',
        body: JSON.stringify({
          idToken: kakaoProof.idToken,
          nonce: kakaoProof.nonce,
          consents: terms.map((term) => ({
            termId: term.term_id,
            agreed: Boolean(agreed[term.term_id]),
          })),
        }),
      });
      if ('consentRequired' in result) throw new Error('약관 동의를 다시 확인해 주세요.');
      setKakaoProof(null);
      await finishLogin(result);
    } catch (error: any) {
      Alert.alert('카카오 가입 실패', error.message ?? String(error));
    } finally {
      setKakaoBusy(false);
    }
  };

  return (
    <>
      <Page>
        <H1>로그인</H1>
        <Card>
          <Input placeholder="이메일" autoCapitalize="none" value={email} onChangeText={setEmail} />
          <Input
            placeholder="비밀번호"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Button title="로그인" onPress={submit} />
          <Button
            title="이메일 인증 메일 다시 받기"
            secondary
            onPress={() => router.push({ pathname: '/auth/verify-email', params: { email } })}
          />
          <Button
            title="비밀번호 재설정"
            secondary
            onPress={() => router.push({ pathname: '/auth/forgot-password', params: { email } })}
          />
        </Card>
        {Platform.OS === 'android' && (
          <Card>
            <Button
              title={kakaoBusy ? '카카오 연결 중…' : '카카오로 로그인'}
              onPress={() => void startKakao()}
            />
            <Muted>카카오 계정은 별도의 이메일 인증이 필요하지 않습니다.</Muted>
          </Card>
        )}
        <Muted>Google · Naver 간편 로그인은 준비 중입니다.</Muted>
        <Text style={{ fontSize: 12, color: palette.muted }}>
          비밀번호는 안전하게 암호화하여 보호합니다.
        </Text>
      </Page>
      <Modal
        visible={Boolean(kakaoProof)}
        animationType="slide"
        onRequestClose={() => setKakaoProof(null)}
      >
        <ScrollView contentContainerStyle={styles.termsPage}>
          <H1>카카오 계정 가입</H1>
          <Muted>처음 이용할 때만 서비스 약관 동의가 필요합니다.</Muted>
          {terms.map((term) => (
            <Card key={term.term_id}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: Boolean(agreed[term.term_id]) }}
                onPress={() =>
                  setAgreed((current) => ({ ...current, [term.term_id]: !current[term.term_id] }))
                }
              >
                <Text style={styles.termTitle}>
                  {agreed[term.term_id] ? '☑' : '☐'} {term.is_required ? '[필수]' : '[선택]'}{' '}
                  {term.title}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setExpandedTerm(expandedTerm === term.term_id ? null : term.term_id)}
              >
                <Text style={styles.viewTerm}>내용 보기 · v{term.version}</Text>
              </Pressable>
              {expandedTerm === term.term_id && (
                <Text style={styles.termContent}>{term.content}</Text>
              )}
            </Card>
          ))}
          <Button
            title={kakaoBusy ? '가입 중…' : '동의하고 가입'}
            onPress={() => void completeKakaoSignup()}
          />
          <Button title="취소" secondary onPress={() => setKakaoProof(null)} />
        </ScrollView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  termsPage: { padding: 20, gap: 12, backgroundColor: palette.bg, flexGrow: 1 },
  termTitle: { color: palette.text, fontSize: 15, fontWeight: '700' },
  viewTerm: { color: palette.accent, fontSize: 13, fontWeight: '700' },
  termContent: { color: palette.text, fontSize: 14, lineHeight: 22 },
});
