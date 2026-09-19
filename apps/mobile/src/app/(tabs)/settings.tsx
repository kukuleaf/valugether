import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, H1, LoadingState, Muted, Page, palette } from '../../components/ui';
import { api } from '../../lib/api';
import { clearTokens, getAccess, getRefresh } from '../../lib/session';

type Profile = {
  email: string;
  email_verified_at: string | null;
  last_login_at: string | null;
  created_at: string;
  preset_count: number;
  watchlist_count: number;
};

export default function Settings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getAccess()
        .then((token) => (token ? api<Profile>('/auth/me', undefined, true) : null))
        .then((data) => active && setProfile(data))
        .catch(() => active && setProfile(null))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, []),
  );

  const logout = async () => {
    const refreshToken = await getRefresh();
    if (refreshToken) {
      try {
        await api('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      } catch {}
    }
    await clearTokens();
    setProfile(null);
  };

  return (
    <Page>
      <H1>내 정보</H1>
      {loading ? (
        <LoadingState label="회원정보를 확인하고 있어요" />
      ) : profile ? (
        <>
          <Card>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={24} color={palette.accent} />
              </View>
              <View style={styles.profileCopy}>
                <Text style={styles.email}>{profile.email}</Text>
                <Muted>{profile.email_verified_at ? '이메일 인증 완료' : '이메일 미인증'}</Muted>
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
            <Button title="알림 설정" onPress={() => router.push('/notification-settings')} />
            <Button title="맞춤기업 기준 관리" secondary onPress={() => router.push('/custom')} />
            <Button title="로그아웃" secondary onPress={logout} />
          </Card>
        </>
      ) : (
        <>
          <Card>
            <Muted>회원정보는 이메일과 인증정보 위주로 최소 수집합니다.</Muted>
            <Button title="로그인" onPress={() => router.push('/auth/login')} />
            <Button title="회원가입" secondary onPress={() => router.push('/auth/register')} />
          </Card>
          <Card>
            <Muted>광고 없이 이용하기와 추가 분석 기능은 추후 제공할 예정입니다.</Muted>
          </Card>
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
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
