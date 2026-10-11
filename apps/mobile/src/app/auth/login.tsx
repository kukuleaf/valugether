import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { saveTokens } from '../../lib/session';
import { Button, Card, H1, Input, Muted, Page, palette } from '../../components/ui';
import { kakaoLogin, KakaoProof } from '../../lib/kakao';
import { isNaverLoginAvailable, naverLogin, naverLogout } from '../../lib/naver';

type Tokens = { accessToken: string; refreshToken: string };
type SocialResponse = Tokens | { consentRequired: true };
type SocialProof =
  (KakaoProof & { provider: 'KAKAO'; nonce: string }) | { provider: 'NAVER'; refreshToken: string };
type Term = {
  term_id: number;
  title: string;
  version: string;
  content: string;
  is_required: boolean;
};

export default function Login() {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <Page>
        <H1>로그인</H1>
        <LoginContent />
      </Page>
    </ScrollView>
  );
}

export function LoginContent({ onSuccess }: { onSuccess?: () => void | Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [kakaoBusy, setKakaoBusy] = useState(false);
  const [naverBusy, setNaverBusy] = useState(false);
  const [socialProof, setSocialProof] = useState<SocialProof | null>(null);
  const [terms, setTerms] = useState<Term[]>([]);
  const [agreed, setAgreed] = useState<Record<number, boolean>>({});
  const [expandedTerm, setExpandedTerm] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [termsError, setTermsError] = useState('');
  const socialBusy = kakaoBusy || naverBusy;
  const naverAvailable = isNaverLoginAvailable();
  const signupProviderName = socialProof?.provider === 'NAVER' ? '네이버' : '카카오';

  const finishLogin = async (tokens: Tokens) => {
    await saveTokens(tokens);
    if (onSuccess) await onSuccess();
    else router.replace('/settings');
  };

  const submit = async () => {
    if (submitting || socialBusy) return;
    setError('');
    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const tokens = await api<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      await finishLogin(tokens);
      Alert.alert('로그인 성공', '안전하게 로그인되었습니다.');
    } catch (e: any) {
      setError(e.message);
      Alert.alert('로그인 실패', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const startKakao = async () => {
    if (socialBusy || submitting) return;
    setError('');
    setKakaoBusy(true);
    try {
      const { nonce } = await api<{ nonce: string }>('/auth/kakao/nonce', { method: 'POST' });
      const proof = await kakaoLogin(nonce);
      const result = await api<SocialResponse>('/auth/kakao/login', {
        method: 'POST',
        body: JSON.stringify({ idToken: proof.idToken, nonce }),
      });
      if ('consentRequired' in result) {
        const activeTerms = await api<Term[]>('/terms/active');
        setTerms(activeTerms);
        setAgreed({});
        setTermsError('');
        setSocialProof({ ...proof, nonce, provider: 'KAKAO' });
      } else {
        await finishLogin(result);
      }
    } catch (error: any) {
      setError(error.message ?? String(error));
      Alert.alert('카카오 로그인 실패', error.message ?? String(error));
    } finally {
      setKakaoBusy(false);
    }
  };

  const startNaver = async () => {
    if (socialBusy || submitting || !naverAvailable) return;
    setError('');
    setNaverBusy(true);
    try {
      const proof = await naverLogin();
      const result = await api<SocialResponse>('/auth/naver/login', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: proof.refreshToken }),
      });
      if ('consentRequired' in result) {
        const activeTerms = await api<Term[]>('/terms/active');
        setTerms(activeTerms);
        setAgreed({});
        setTermsError('');
        setSocialProof({ refreshToken: proof.refreshToken, provider: 'NAVER' });
      } else {
        await finishLogin(result);
      }
    } catch (cause: any) {
      const message = cause.message ?? '네이버 로그인에 실패했습니다. 다시 시도해 주세요.';
      setError(message);
      Alert.alert('네이버 로그인', message);
    } finally {
      setNaverBusy(false);
    }
  };

  const cancelSignup = () => {
    if (socialBusy) return;
    if (socialProof?.provider === 'NAVER') {
      setNaverBusy(true);
      void naverLogout()
        .catch(() => undefined)
        .finally(() => setNaverBusy(false));
    }
    setSocialProof(null);
    setTerms([]);
    setAgreed({});
    setTermsError('');
  };

  const completeSocialSignup = async () => {
    if (!socialProof || socialBusy) return;
    setTermsError('');
    if (terms.some((term) => term.is_required && !agreed[term.term_id])) {
      setTermsError('필수 약관에 동의해 주세요.');
      Alert.alert('필수 동의 필요', '필수 약관에 동의해 주세요.');
      return;
    }
    const setBusy = socialProof.provider === 'NAVER' ? setNaverBusy : setKakaoBusy;
    setBusy(true);
    try {
      const proof =
        socialProof.provider === 'NAVER'
          ? { refreshToken: socialProof.refreshToken }
          : { idToken: socialProof.idToken, nonce: socialProof.nonce };
      const result = await api<SocialResponse>(
        socialProof.provider === 'NAVER' ? '/auth/naver/login' : '/auth/kakao/login',
        {
          method: 'POST',
          body: JSON.stringify({
            ...proof,
            consents: terms.map((term) => ({
              termId: term.term_id,
              agreed: Boolean(agreed[term.term_id]),
            })),
          }),
        },
      );
      if ('consentRequired' in result) throw new Error('약관 동의를 다시 확인해 주세요.');
      setSocialProof(null);
      await finishLogin(result);
    } catch (error: any) {
      setTermsError(error.message ?? '가입에 실패했습니다. 다시 시도해 주세요.');
      Alert.alert(`${signupProviderName} 가입 실패`, error.message ?? '다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card>
        <Text style={styles.socialTitle}>이메일 로그인</Text>
        <Input
          accessibilityLabel="이메일"
          placeholder="이메일"
          keyboardType="email-address"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />
        <Input
          placeholder="비밀번호"
          accessibilityLabel="비밀번호"
          autoComplete="current-password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Button
          title={submitting ? '로그인 중…' : '로그인'}
          disabled={submitting || socialBusy}
          onPress={submit}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>
      <Card>
        <Text style={styles.socialTitle}>비밀번호 찾기</Text>
        <Muted>이메일이 아이디입니다. 가입한 이메일로 재설정 링크를 보냅니다.</Muted>
        <Button
          title="비밀번호 찾기"
          disabled={submitting || socialBusy}
          secondary
          onPress={() => router.push({ pathname: '/auth/forgot-password', params: { email } })}
        />
      </Card>
      <Card>
        <Text style={styles.socialTitle}>간편 로그인</Text>
        <Pressable
          testID="social-google"
          accessibilityRole="button"
          accessibilityLabel="Google로 로그인 · 현재 이용 불가"
          accessibilityState={{ disabled: true }}
          disabled
          style={[styles.socialButton, styles.googleButton, styles.unavailableSocialButton]}
        >
          <Image
            testID="google-login-image"
            accessible={false}
            source={require('../../../assets/social/google-sign-in.png')}
            resizeMode="contain"
            style={styles.socialImage}
          />
        </Pressable>
        <Pressable
          testID="social-kakao"
          accessibilityRole="button"
          accessibilityLabel="카카오로 로그인"
          accessibilityState={{ disabled: socialBusy || submitting, busy: kakaoBusy }}
          disabled={socialBusy || submitting}
          onPress={() => void startKakao()}
          style={[styles.socialButton, styles.kakaoButton]}
        >
          <Image
            testID="kakao-login-image"
            accessible={false}
            source={require('../../../assets/social/kakao-login-ko.png')}
            resizeMode="contain"
            style={styles.socialImage}
          />
        </Pressable>
        {kakaoBusy && (
          <Text accessibilityLiveRegion="polite" style={styles.socialStatus}>
            카카오 연결 중…
          </Text>
        )}
        <Pressable
          testID="social-naver"
          accessibilityRole="button"
          accessibilityLabel="네이버로 로그인"
          accessibilityState={{
            disabled: !naverAvailable || socialBusy || submitting,
            busy: naverBusy,
          }}
          disabled={!naverAvailable || socialBusy || submitting}
          onPress={() => void startNaver()}
          style={[
            styles.socialButton,
            styles.naverButton,
            !naverAvailable && styles.unavailableSocialButton,
          ]}
        >
          <Image
            testID="naver-login-image"
            accessible={false}
            source={require('../../../assets/social/naver-login-ko.png')}
            resizeMode="contain"
            style={styles.socialImage}
          />
        </Pressable>
        {naverBusy && (
          <Text accessibilityLiveRegion="polite" style={styles.socialStatus}>
            네이버 연결 중…
          </Text>
        )}
      </Card>
      <Card>
        <Text style={styles.socialTitle}>회원가입</Text>
        <Button
          title="새 계정 만들기"
          disabled={submitting || socialBusy}
          secondary
          onPress={() => router.push('/auth/register')}
        />
      </Card>
      <Text style={{ fontSize: 12, color: palette.muted }}>
        비밀번호는 안전하게 암호화하여 보호합니다.
      </Text>
      <Modal visible={Boolean(socialProof)} animationType="slide" onRequestClose={cancelSignup}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.modalScreen}>
          <ScrollView contentContainerStyle={styles.termsPage}>
            <H1>{signupProviderName} 계정 가입</H1>
            <Muted>처음 이용할 때만 서비스 약관 동의가 필요합니다.</Muted>
            {terms.map((term) => (
              <Card key={term.term_id}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: Boolean(agreed[term.term_id]) }}
                  disabled={socialBusy}
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
                  accessibilityRole="button"
                  onPress={() =>
                    setExpandedTerm(expandedTerm === term.term_id ? null : term.term_id)
                  }
                >
                  <Text style={styles.viewTerm}>내용 보기 · v{term.version}</Text>
                </Pressable>
                {expandedTerm === term.term_id && (
                  <Text style={styles.termContent}>{term.content}</Text>
                )}
              </Card>
            ))}
            <Button
              title={socialBusy ? '가입 중…' : '동의하고 가입'}
              disabled={socialBusy}
              onPress={() => void completeSocialSignup()}
            />
            {termsError ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {termsError}
              </Text>
            ) : null}
            <Button title="취소" disabled={socialBusy} secondary onPress={cancelSignup} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { paddingBottom: 24 },
  error: { color: '#A00000', lineHeight: 21 },
  modalScreen: { flex: 1, backgroundColor: palette.bg },
  socialTitle: { color: palette.text, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  socialButton: {
    minHeight: 48,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButton: { aspectRatio: 720 / 160 },
  kakaoButton: { aspectRatio: 896 / 184 },
  naverButton: { aspectRatio: 840 / 192 },
  unavailableSocialButton: { opacity: 0.5 },
  socialImage: { width: '100%', height: '100%' },
  socialStatus: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 4,
  },
  termsPage: { padding: 20, gap: 12, backgroundColor: palette.bg, flexGrow: 1 },
  termTitle: { color: palette.text, fontSize: 15, fontWeight: '700' },
  viewTerm: { color: palette.accent, fontSize: 13, fontWeight: '700' },
  termContent: { color: palette.text, fontSize: 14, lineHeight: 22 },
});
