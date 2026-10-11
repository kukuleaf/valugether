import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, H1, LoadingState, Muted, Page, palette } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { getAccess } from '../../lib/session';

type WatchItem = {
  security_id: number | null;
  ticker: string | null;
  security_name: string | null;
};

export default function Watchlist() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [items, setItems] = useState<WatchItem[]>([]);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoggedIn(null);
      setError('');
      setItems([]);
      void getAccess()
        .then(async (token) => {
          if (!active) return;
          if (!token) {
            setLoggedIn(false);
            setItems([]);
            return;
          }
          try {
            const rows = await api<WatchItem[]>('/watchlists/default', undefined, true);
            if (active) {
              setItems(rows.filter((row) => row.security_id != null));
              setLoggedIn(true);
            }
          } catch (cause: any) {
            if (active) {
              setError(cause.message ?? '관심기업을 불러오지 못했습니다.');
              setLoggedIn(!(cause instanceof ApiError && cause.status === 401));
            }
          }
        })
        .catch((cause: Error) => {
          if (active) {
            setError(cause.message);
            setLoggedIn(true);
          }
        });
      return () => {
        active = false;
      };
    }, [reload]),
  );

  if (loggedIn === null)
    return (
      <Page>
        <LoadingState label="관심기업을 확인하고 있어요" />
      </Page>
    );
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Page>
        <H1>관심기업</H1>
        {!loggedIn ? (
          <Card>
            <Text style={styles.title}>로그인이 필요합니다</Text>
            <Muted>{error || '관심기업은 계정에 저장됩니다.'}</Muted>
            <Button title="로그인" onPress={() => router.push('/auth/login')} />
            <Button title="회원가입" secondary onPress={() => router.push('/auth/register')} />
          </Card>
        ) : error ? (
          <Card>
            <Muted>{error}</Muted>
            <Button
              title="다시 시도"
              secondary
              onPress={() => setReload((current) => current + 1)}
            />
          </Card>
        ) : items.length ? (
          items.map((item) => (
            <Pressable
              key={item.security_id}
              accessibilityRole="button"
              accessibilityLabel={`${item.security_name ?? item.ticker} 기업 상세`}
              onPress={() => router.push(`/stocks/${item.security_id}`)}
            >
              <Card style={styles.row}>
                <View style={styles.copy}>
                  <Text style={styles.title}>{item.ticker}</Text>
                  <Muted>{item.security_name}</Muted>
                </View>
                <Ionicons name="chevron-forward" size={20} color={palette.muted} />
              </Card>
            </Pressable>
          ))
        ) : (
          <Card>
            <Text style={styles.title}>아직 관심기업이 없습니다</Text>
            <Muted>기업 상세에서 하트를 눌러 추가하세요.</Muted>
          </Card>
        )}
      </Page>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: palette.bg },
  content: { paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center' },
  copy: { flex: 1 },
  title: { color: palette.text, fontWeight: '800', fontSize: 16 },
});
