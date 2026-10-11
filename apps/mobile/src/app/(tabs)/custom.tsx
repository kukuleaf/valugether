import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, H1, LoadingState, Muted, Page, palette } from '../../components/ui';
import { api, ApiError, runScreening, ScreenPreset, ScreenResult } from '../../lib/api';
import { PriceDataNotice } from '../../components/PriceDataNotice';
import { getAccess } from '../../lib/session';

type Notification = {
  notification_id: number;
  preset_id: number | null;
  title: string;
  body: string;
  created_at: string;
};

export default function CustomCompanies() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [presets, setPresets] = useState<ScreenPreset[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [results, setResults] = useState<ScreenResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [reload, setReload] = useState(0);
  const focusVersion = useRef(0);

  const load = useCallback(async (isActive: () => boolean) => {
    setLoggedIn(null);
    setError('');
    setResults([]);
    setSearched(false);
    setLoading(false);
    setPresets([]);
    setNotifications([]);
    let hasSession = false;
    try {
      const token = await getAccess();
      if (!isActive()) return;
      hasSession = Boolean(token);
      if (!token) {
        setLoggedIn(false);
        setSelectedId(null);
        return;
      }
      const [items, inbox] = await Promise.all([
        api<ScreenPreset[]>('/presets', undefined, true),
        api<Notification[]>('/presets/notifications/inbox', undefined, true),
      ]);
      if (!isActive()) return;
      setPresets(items);
      setNotifications(inbox);
      setLoggedIn(true);
      setSelectedId((current) =>
        items.some((item) => item.preset_id === current) ? current : (items[0]?.preset_id ?? null),
      );
    } catch (cause: any) {
      if (!isActive()) return;
      setError(cause.message);
      setLoggedIn(hasSession && !(cause instanceof ApiError && cause.status === 401));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      focusVersion.current += 1;
      void load(() => active);
      return () => {
        active = false;
        focusVersion.current += 1;
      };
    }, [load, reload]),
  );

  const selected = presets.find((preset) => preset.preset_id === selectedId) ?? null;

  const search = async () => {
    if (!selected || loading) return;
    setLoading(true);
    setError('');
    const version = focusVersion.current;
    try {
      const data = await runScreening({
        conditions: selected.conditions,
        marketCodes: selected.market_filter_json,
        exchangeCodes: selected.exchange_filter_json,
        limit: 20,
      });
      if (version === focusVersion.current) {
        setResults(data.results);
        setSearched(true);
      }
    } catch (cause: any) {
      if (version === focusVersion.current) setError(cause.message);
    } finally {
      if (version === focusVersion.current) setLoading(false);
    }
  };

  if (loggedIn === null) return <LoadingState label="맞춤기업을 준비하고 있어요" />;

  if (!loggedIn) {
    return (
      <Page>
        <H1>맞춤기업</H1>
        <Muted>저장한 기준으로 조건을 충족한 기업을 한곳에서 확인합니다.</Muted>
        <Card>
          <Text style={styles.cardTitle}>로그인이 필요합니다</Text>
          <Muted>{error || '프리셋과 알림 설정은 계정에 안전하게 저장됩니다.'}</Muted>
          <Button title="로그인" onPress={() => router.push('/auth/login')} />
          <Button title="회원가입" secondary onPress={() => router.push('/auth/register')} />
        </Card>
      </Page>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      <Page>
        <H1>맞춤기업</H1>
        <Muted>내 프리셋을 충족한 기업과 새 소식을 확인합니다.</Muted>

        {error ? (
          <Card>
            <Text style={styles.error}>{error}</Text>
            <Button
              title="다시 시도"
              secondary
              onPress={() => setReload((current) => current + 1)}
            />
          </Card>
        ) : null}

        {!!notifications.length && (
          <Card style={styles.notificationCard}>
            <View style={styles.notificationIcon}>
              <Ionicons name="notifications" size={20} color={palette.accent} />
            </View>
            <View style={styles.notificationCopy}>
              <Text style={styles.notificationTitle}>{notifications[0].title}</Text>
              <Muted>{notifications[0].body}</Muted>
            </View>
          </Card>
        )}

        {!presets.length && !error ? (
          <Card>
            <Text style={styles.cardTitle}>저장된 프리셋이 없습니다</Text>
            <Muted>조건검색에서 기준을 만든 뒤 저장해 주세요.</Muted>
            <Button title="프리셋 만들기" onPress={() => router.push('/advanced')} />
          </Card>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.presetRow}>
                {presets.map((preset) => (
                  <Pressable
                    key={preset.preset_id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: selectedId === preset.preset_id }}
                    disabled={loading}
                    onPress={() => {
                      setSelectedId(preset.preset_id);
                      setResults([]);
                      setSearched(false);
                    }}
                    style={[
                      styles.presetChip,
                      selectedId === preset.preset_id && styles.presetChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        selectedId === preset.preset_id && styles.presetChipTextActive,
                      ]}
                    >
                      {preset.preset_name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {selected && (
              <Card>
                <View style={styles.settingHeader}>
                  <View style={styles.settingCopy}>
                    <Text style={styles.cardTitle}>{selected.preset_name}</Text>
                    <Muted>
                      {selected.conditions.length}개 조건 ·{' '}
                      {selected.exchange_filter_json?.join(' · ') || '전체 시장'}
                    </Muted>
                  </View>
                </View>
                <Button title="오늘의 조건 충족 기업 조회" disabled={loading} onPress={search} />
                <Button
                  title="기준 상세·수정"
                  secondary
                  onPress={() => router.push(`/presets/${selected.preset_id}`)}
                />
              </Card>
            )}
          </>
        )}

        {loading && <LoadingState label="최신 지표와 비교하고 있어요" />}
        {!!results.length && (
          <View style={styles.results}>
            <Text style={styles.resultTitle}>조건 충족·근접 기업 {results.length}개</Text>
            {results.map((company) => (
              <Pressable
                key={company.securityId}
                accessibilityRole="button"
                accessibilityLabel={`${company.name} 기업 상세`}
                onPress={() => router.push(`/stocks/${company.securityId}`)}
              >
                <Card style={styles.companyCard}>
                  <View style={styles.companyCopy}>
                    <Text style={styles.ticker}>{company.ticker}</Text>
                    <Muted>{company.name}</Muted>
                    <PriceDataNotice
                      status={company.priceStatus}
                      asOfDate={company.priceAsOfDate}
                    />
                  </View>
                  <Text style={styles.match}>
                    {company.matchType === 'EXACT' ? '충족' : '근접'} {company.similarity}%
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={palette.muted} />
                </Card>
              </Pressable>
            ))}
          </View>
        )}
        {searched && !loading && !error && !results.length && (
          <Card>
            <Text style={styles.cardTitle}>오늘 조건에 맞는 기업이 없습니다</Text>
            <Muted>조건을 조금 넓혀 다시 조회해 보세요.</Muted>
          </Card>
        )}
      </Page>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: palette.bg },
  scrollContent: { paddingBottom: 30 },
  cardTitle: { color: palette.text, fontSize: 17, fontWeight: '900' },
  presetRow: { flexDirection: 'row', gap: 8 },
  presetChip: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 999,
    backgroundColor: 'white',
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  presetChipActive: { borderColor: palette.accent, backgroundColor: '#E8F2F5' },
  presetChipText: { color: palette.muted, fontWeight: '700' },
  presetChipTextActive: { color: palette.accent },
  settingHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingCopy: { flex: 1 },
  error: { color: '#A00000', lineHeight: 21 },
  results: { gap: 9 },
  resultTitle: { color: palette.text, fontSize: 18, fontWeight: '900' },
  companyCard: { flexDirection: 'row', alignItems: 'center' },
  companyCopy: { flex: 1 },
  ticker: { color: palette.text, fontSize: 16, fontWeight: '900' },
  match: { color: palette.accent, fontSize: 12, fontWeight: '800', marginRight: 4 },
  notificationCard: { flexDirection: 'row', alignItems: 'center' },
  notificationIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#E8F2F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationCopy: { flex: 1 },
  notificationTitle: { color: palette.text, fontSize: 14, fontWeight: '900' },
});
