import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, H1, LoadingState, Muted, Page, palette } from '../components/ui';
import { PersistentTabBar } from '../components/PersistentTabBar';
import { PriceDataNotice } from '../components/PriceDataNotice';
import { runScreening, ScreenResult } from '../lib/api';
import { InlineBanner } from '../ads/InlineBanner';

const operatorLabels: Record<string, string> = {
  LTE: '이하',
  GTE: '이상',
  LT: '미만',
  GT: '초과',
  EQ: '같음',
  BETWEEN: '범위',
};

const marketLabels: Record<string, string> = {
  KR: '한국',
  US: '미국',
};
const exchangeLabels: Record<string, string> = {
  KOSPI: '코스피',
  KOSDAQ: '코스닥',
  NASDAQ: '나스닥',
  NYSE: '뉴욕증권거래소',
};

function metricValue(value: number, unitType?: string) {
  if (unitType === 'PERCENT') return `${value}%`;
  if (unitType === 'RATIO') return `${value}배`;
  if (unitType === 'COUNT') return `${value}년`;
  if (unitType === 'BOOLEAN') return value ? '예' : '아니요';
  return String(value);
}

export default function Results() {
  const params = useLocalSearchParams<{
    strategy?: string;
    conditions?: string;
    exchanges?: string;
  }>();
  const [data, setData] = useState<{
    exactCount: number;
    nearCount: number;
    results: ScreenResult[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setError(null);
        setData(null);
        const conditions = params.conditions ? JSON.parse(params.conditions) : undefined;
        const exchangeCodes = params.exchanges ? JSON.parse(params.exchanges) : undefined;
        const result = await runScreening({
            strategyCode: params.strategy,
            conditions,
            exchangeCodes,
            limit: 50,
          });
        if (active) setData(result);
      } catch (e: any) {
        if (active) setError(e.message ?? String(e));
      }
    })();
    return () => { active = false; };
  }, [params.strategy, params.conditions, params.exchanges, retryCount]);
  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Page>
          <Pressable accessibilityRole="button" accessibilityLabel="이전 화면으로" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.backRow}>
            <Ionicons name="arrow-back" size={22} color={palette.text} />
            <Text style={styles.backText}>검색 결과</Text>
          </Pressable>
          {!data && !error && <LoadingState label="조건에 맞는 회사를 찾고 있어요" />}
          {error ? (
            <Card>
              <Text style={{ color: '#A00000', fontWeight: '700' }}>검색 실패</Text>
              <Muted>{error}</Muted>
              <Muted>잠시 후 다시 시도해 주세요.</Muted>
              <Button title="다시 검색" onPress={() => setRetryCount((count) => count + 1)} />
            </Card>
          ) : null}
          {data && (
            <>
              <View style={styles.counts}>
                <Card style={styles.countCard}>
                  <Text style={styles.big}>{data.exactCount}</Text>
                  <Muted>정확 일치</Muted>
                </Card>
                <Card style={styles.countCard}>
                  <Text style={styles.big}>{data.nearCount}</Text>
                  <Muted>근접 후보</Muted>
                </Card>
              </View>
              {!data.results.length && (
                <Card>
                  <Text style={styles.emptyTitle}>조건에 맞는 기업이 없습니다</Text>
                  <Muted>조건을 바꾸거나 나중에 다시 검색해 주세요.</Muted>
                </Card>
              )}
              {data.results.map((x, index) => (
                <Fragment key={x.securityId}>
                <Pressable
                  key={x.securityId}
                  accessibilityRole="button"
                  accessibilityLabel={`${x.name} 상세정보 보기`}
                  onPress={() => router.push(`/stocks/${x.securityId}`)}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Card>
                    <View style={styles.header}>
                      <View style={styles.company}>
                        <Text style={styles.ticker}>{x.ticker}</Text>
                        <Muted>
                          {x.name} ·{' '}
                          {exchangeLabels[x.exchangeCode] ??
                            marketLabels[x.marketCode] ??
                            x.marketCode}
                        </Muted>
                      </View>
                      <View style={[styles.badge, x.matchType === 'NEAR' && styles.near]}>
                        <Text style={styles.badgeText}>
                          {x.matchType === 'EXACT' ? '조건 일치' : '근접 후보'} {x.similarity}%
                        </Text>
                      </View>
                    </View>
                    <PriceDataNotice status={x.priceStatus} asOfDate={x.priceAsOfDate} />
                    {x.details.map((d) => (
                      <View key={d.metricCode} style={styles.metric}>
                        <Text style={styles.metricLabel}>{d.metricName ?? d.metricCode}</Text>
                        <Text
                          style={[
                            styles.metricValue,
                            { color: d.status === 'NEAR' ? palette.near : palette.muted },
                          ]}
                        >
                          {d.actual == null ? '자료 없음' : metricValue(d.actual, d.unitType)} /
                          기준 {metricValue(d.target, d.unitType)}{' '}
                          {operatorLabels[d.operator] ?? ''}
                          {d.status === 'NEAR' ? ' · 근접' : ''}
                          {d.asOfDate ? ` · 지표 ${d.asOfDate.slice(0, 10)} 기준` : ''}
                        </Text>
                      </View>
                    ))}
                    <View style={styles.detailLink}>
                      <Text style={styles.detailLinkText}>기업 상세정보 보기</Text>
                      <Ionicons name="chevron-forward" size={16} color={palette.accent} />
                    </View>
                  </Card>
                </Pressable>
                {index === 4 && data.results.length >= 6 && <InlineBanner placement="results" />}
                </Fragment>
              ))}
            </>
          )}
        </Page>
      </ScrollView>
      <PersistentTabBar />
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  scroll: { flex: 1 },
  scrollContent: { alignItems: 'center', paddingBottom: 30 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  backText: { color: palette.text, fontSize: 24, fontWeight: '800' },
  counts: { flexDirection: 'row', gap: 10, width: '100%' },
  countCard: { flex: 1, minWidth: 0 },
  big: { fontSize: 24, fontWeight: '800', color: palette.text },
  emptyTitle: { color: palette.text, fontWeight: '800', fontSize: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  company: { flex: 1, minWidth: 0, paddingRight: 10 },
  ticker: { fontSize: 18, fontWeight: '800', color: palette.text },
  badge: {
    backgroundColor: '#E8F0FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  near: { backgroundColor: '#FFF2D5' },
  badgeText: { fontSize: 12, fontWeight: '700', color: palette.text },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  metric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: palette.line,
    paddingTop: 8,
    marginTop: 4,
  },
  metricLabel: { flexShrink: 0, fontWeight: '600', color: palette.text },
  metricValue: { flex: 1, minWidth: 0, marginLeft: 12, textAlign: 'right' },
  detailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    paddingTop: 8,
  },
  detailLinkText: { color: palette.accent, fontSize: 12, fontWeight: '800' },
});
