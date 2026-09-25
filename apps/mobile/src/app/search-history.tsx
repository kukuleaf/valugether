import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, H1, LoadingState, Muted, Page, palette } from '../components/ui';
import { api, ScreenCondition } from '../lib/api';

type SearchRequest = {
  strategyCode?: string;
  marketCodes?: string[];
  exchangeCodes?: string[];
  conditions?: ScreenCondition[];
};

type HistoryItem = {
  id: number;
  searchMode: string;
  strategyCode: string | null;
  strategyName: string | null;
  request: SearchRequest;
  exactCount: number;
  nearCount: number;
  elapsedMs: number | null;
  createdAt: string;
};

type HistoryPage = {
  items: HistoryItem[];
  hasMore: boolean;
  nextCursor: number | null;
};

export default function SearchHistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (beforeId?: number, append = false) => {
    append ? setLoadingMore(true) : setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ limit: '30' });
      if (beforeId) query.set('beforeId', String(beforeId));
      const page = await api<HistoryPage>(`/screening/history?${query}`, undefined, true);
      setItems((current) => (append ? [...current, ...page.items] : page.items));
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
    } catch (cause: any) {
      setError(cause.message ?? String(cause));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const repeat = (item: HistoryItem) => {
    const params: Record<string, string> = {};
    if (item.request.strategyCode) params.strategy = item.request.strategyCode;
    if (item.request.conditions?.length) {
      params.conditions = JSON.stringify(item.request.conditions);
    }
    if (item.request.exchangeCodes?.length) {
      params.exchanges = JSON.stringify(item.request.exchangeCodes);
    }
    router.push({ pathname: '/results', params });
  };

  const remove = (item: HistoryItem) => {
    Alert.alert('검색 이력 삭제', '이 검색 기록을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/screening/history/${item.id}`, { method: 'DELETE' }, true);
            setItems((current) => current.filter((candidate) => candidate.id !== item.id));
          } catch (cause: any) {
            setError(cause.message ?? String(cause));
          }
        },
      },
    ]);
  };

  const clear = () => {
    Alert.alert('검색 이력 전체 삭제', '모든 검색 기록을 삭제할까요? 복구할 수 없습니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '전체 삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await api('/screening/history', { method: 'DELETE' }, true);
            setItems([]);
            setHasMore(false);
            setNextCursor(null);
          } catch (cause: any) {
            setError(cause.message ?? String(cause));
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      <Page>
        <View style={styles.titleRow}>
          <H1>검색 이력</H1>
          {!!items.length && (
            <Pressable accessibilityRole="button" onPress={clear} style={styles.clearButton}>
              <Text style={styles.clearText}>전체 삭제</Text>
            </Pressable>
          )}
        </View>
        <Muted>로그인 상태에서 실행한 검색을 다시 열거나 삭제할 수 있습니다.</Muted>

        {loading ? <LoadingState label="검색 이력을 불러오고 있어요" /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !items.length ? (
          <Card>
            <Text style={styles.emptyTitle}>저장된 검색 이력이 없습니다</Text>
            <Muted>기업 검색을 실행하면 여기에 자동으로 기록됩니다.</Muted>
            <Button title="기업 검색하기" onPress={() => router.push('/')} />
          </Card>
        ) : null}

        {items.map((item) => (
          <Card key={item.id}>
            <View style={styles.itemHeader}>
              <View style={styles.itemCopy}>
                <Text style={styles.itemTitle}>
                  {item.strategyName ??
                    (item.searchMode === 'GENERAL' ? '간편 전략 검색' : '조건 검색')}
                </Text>
                <Muted>{formatDate(item.createdAt)}</Muted>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="검색 이력 삭제"
                onPress={() => remove(item)}
                style={styles.iconButton}
              >
                <Ionicons name="trash-outline" size={19} color="#B42318" />
              </Pressable>
            </View>
            <Text style={styles.summary}>{requestSummary(item.request)}</Text>
            <View style={styles.countRow}>
              <Text style={styles.exact}>조건 일치 {item.exactCount}</Text>
              <Text style={styles.near}>근접 {item.nearCount}</Text>
              {item.elapsedMs != null ? <Muted>{item.elapsedMs}ms</Muted> : null}
            </View>
            <Button title="같은 조건으로 다시 검색" secondary onPress={() => repeat(item)} />
          </Card>
        ))}

        {hasMore && nextCursor ? (
          <Button
            title={loadingMore ? '불러오는 중…' : '이전 기록 더 보기'}
            secondary
            onPress={() => !loadingMore && void load(nextCursor, true)}
          />
        ) : null}
      </Page>
    </ScrollView>
  );
}

function requestSummary(request: SearchRequest) {
  const markets =
    request.exchangeCodes?.join(' · ') || request.marketCodes?.join(' · ') || '전체 시장';
  if (request.strategyCode) return `${markets} · ${request.strategyCode}`;
  return `${markets} · 조건 ${request.conditions?.length ?? 0}개`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  scrollContent: { paddingBottom: 30 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clearButton: { paddingHorizontal: 10, paddingVertical: 7 },
  clearText: { color: '#B42318', fontSize: 13, fontWeight: '800' },
  error: { color: '#A00000', lineHeight: 21 },
  emptyTitle: { color: palette.text, fontSize: 17, fontWeight: '900' },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemCopy: { flex: 1, minWidth: 0 },
  itemTitle: { color: palette.text, fontSize: 17, fontWeight: '900' },
  iconButton: { padding: 8, borderRadius: 10, backgroundColor: '#FFF5F5' },
  summary: { color: palette.text, fontSize: 13, lineHeight: 20 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  exact: { color: palette.accent, fontSize: 13, fontWeight: '800' },
  near: { color: palette.near, fontSize: 13, fontWeight: '800' },
});
