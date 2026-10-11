import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, H1, LoadingState, Muted, Page, palette } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { clearTokens, getAccess, getRefresh } from '../../lib/session';
import { kakaoLogout } from '../../lib/kakao';
import { naverLogout } from '../../lib/naver';
import { LoginContent } from '../auth/login';
import { AdsPrivacyButton } from '../../ads/AdsProvider';

type Profile = {
  email: string | null;
  social_email: string | null;
  email_verified_at: string | null;
  last_login_at: string | null;
  created_at: string;
  has_password: boolean;
  social_providers: string[];
  preset_count: number;
  watchlist_count: number;
};

export default function Settings() {
  const params = useLocalSearchParams<{ naverDisconnectPending?: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const providerNames: Record<string, string> = {
    KAKAO: '카카오',
    NAVER: '네이버',
    GOOGLE: 'Google',
  };
  const socialProvider =
    profile?.social_providers.find((provider) => provider === 'KAKAO' || provider === 'NAVER') ??
    '';
  const socialName =
    profile?.social_providers.map((provider) => providerNames[provider] ?? '간편').join(' · ') ||
    '간편';

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError('');
      getAccess()
        .then((token) => (token ? api<Profile>('/auth/me', undefined, true) : null))
        .then((data) => active && setProfile(data))
        .catch((cause: Error) => {
          if (!active) return;
          setProfile(null);
          if (!(cause instanceof ApiError && cause.status === 401)) setError(cause.message);
        })
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [reload]),
  );

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const refreshToken = await getRefresh();
      await clearTokens();
      setProfile(null);
      if (refreshToken) {
        await api('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        }).catch(() => undefined);
      }
      if (profile?.social_providers.includes('KAKAO')) {
        await kakaoLogout().catch(() => undefined);
      }
      if (profile?.social_providers.includes('NAVER')) {
        await naverLogout().catch(() => undefined);
      }
    } catch (cause: any) {
      setError(cause.message);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Page>
        <View style={styles.heading}>
          <H1>내 정보</H1>
          {profile && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="알림 설정"
              onPress={() => router.push('/notification-settings')}
              style={styles.settingsIcon}
            >
              <Ionicons name="settings-outline" size={24} color={palette.text} />
            </Pressable>
          )}
        </View>
        {params.naverDisconnectPending === 'true' && (
          <Card>
            <Text style={styles.email}>계정 삭제 완료</Text>
            <Muted>
              계정과 저장된 데이터가 삭제되었습니다. 네이버 연결 해제가 지연되어 네이버의 연결된
              서비스에서 직접 해제해 주세요.
            </Muted>
            <Button
              title="확인"
              secondary
              onPress={() => router.setParams({ naverDisconnectPending: undefined })}
            />
          </Card>
        )}
        {loading ? (
          <LoadingState label="회원정보를 확인하고 있어요" />
        ) : error ? (
          <Card>
            <Muted>{error}</Muted>
            <Button
              title="다시 시도"
              secondary
              onPress={() => setReload((current) => current + 1)}
            />
          </Card>
        ) : profile ? (
          <>
            <Card>
              <View style={styles.profileRow}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={24} color={palette.accent} />
                </View>
                <View style={styles.profileCopy}>
                  <Text style={styles.email}>
                    {profile.email ?? profile.social_email ?? `${socialName} 계정`}
                  </Text>
                  <Muted>
                    {profile.has_password
                      ? profile.email_verified_at
                        ? '이메일 인증 완료'
                        : '이메일 미인증'
                      : `${socialName} 로그인 · 별도 이메일 인증 없음`}
                  </Muted>
                </View>
              </View>
            </Card>
            <View style={styles.stats}>
              <Card style={styles.statCard}>
                <Text style={styles.statValue}>{profile.preset_count}</Text>
                <Muted>저장 프리셋</Muted>
              </Card>
              <Card style={styles.statCard}>
                <Text style={styles.statValue}>{profile.watchlist_count}</Text>
                <Muted>관심기업</Muted>
              </Card>
            </View>
            <Card>
              <Button
                title={loggingOut ? '로그아웃 중…' : '로그아웃'}
                disabled={loggingOut}
                secondary
                onPress={logout}
              />
            </Card>
            <Card>
              <Muted>탈퇴하면 계정과 저장한 사용자 데이터가 즉시 삭제됩니다.</Muted>
              <Button
                title="회원 탈퇴"
                danger
                onPress={() =>
                  router.push({
                    pathname: '/auth/delete-account',
                    params: {
                      hasPassword: String(profile.has_password),
                      socialProvider,
                    },
                  })
                }
              />
            </Card>
          </>
        ) : (
          <LoginContent
            onSuccess={async () => setProfile(await api<Profile>('/auth/me', undefined, true))}
          />
        )}
        <AdsPrivacyButton />
        <Button title="개인정보 처리방침" secondary onPress={() => router.push('/privacy')} />
      </Page>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { paddingBottom: 24 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingsIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#E8F2F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCopy: { flex: 1 },
  email: { color: palette.text, fontSize: 16, fontWeight: '900' },
  stats: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, minWidth: 0 },
  statValue: { color: palette.accent, fontSize: 24, fontWeight: '900' },
});
