import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Card, H1, LoadingState, Muted, Page, palette } from '../../components/ui';
import { api, runScreening, ScreenPreset, ScreenResult } from '../../lib/api';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const load = useCallback(async () => {
    const token = await getAccess();
    setLoggedIn(Boolean(token));
    if (!token) return;
    try {
      const [items, inbox] = await Promise.all([
        api<ScreenPreset[]>('/presets', undefined, true),
        api<Notification[]>('/presets/notifications/inbox', undefined, true),
      ]);
      setPresets(items);
      setNotifications(inbox);
      setSelectedId((current) => current ?? items[0]?.preset_id ?? null);
    } catch (cause: any) {
      setError(cause.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const selected = presets.find((preset) => preset.preset_id === selectedId) ?? null;

  const search = async () => {
    if (!selected) return;
    setLoading(true);
    setError('');
    try {
      const data = await runScreening({
        conditions: selected.conditions,
        marketCodes: selected.market_filter_json,
        limit: 20,
      });
      setResults(data.results);
    } catch (cause: any) {
      setError(cause.message);
    } finally {
      setLoading(false);
    }
  };

  const updateNotification = async (enabled: boolean, intervalDays?: number) => {
    if (!selected) return;
    const days = intervalDays ?? Number(selected.notification_interval_days || 1);
    try {
      await api(
        `/presets/${selected.preset_id}/notification`,
        { method: 'PATCH', body: JSON.stringify({ enabled, intervalDays: days }) },
        true,
      );
      setPresets((current) =>
        current.map((preset) =>
          preset.preset_id === selected.preset_id
            ? { ...preset, notification_enabled: enabled, notification_interval_days: days }
            : preset,
        ),
      );
    } catch (cause: any) {
      setError(cause.message);
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
          <Muted>프리셋과 알림 설정은 계정에 안전하게 저장됩니다.</Muted>
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

        {!presets.length ? (
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
                    onPress={() => {
                      setSelectedId(preset.preset_id);
                      setResults([]);
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
                    <Muted>{selected.conditions.length}개 조건 · 최신 데이터 기준</Muted>
                  </View>
                  <Switch
                    accessibilityLabel="조건 충족 알림"
                    value={selected.notification_enabled}
                    onValueChange={(value) => updateNotification(value)}
                  />
                </View>
                <Text style={styles.sectionLabel}>알림 주기</Text>
                <View style={styles.intervalRow}>
                  {[1, 3, 7, 14].map((days) => (
                    <Pressable
                      key={days}
                      onPress={() => updateNotification(selected.notification_enabled, days)}
                      style={[
                        styles.interval,
                        selected.notification_interval_days === days && styles.intervalActive,
                      ]}
                    >
                      <Text style={styles.intervalText}>
                        {days === 1 ? '매일' : `${days}일마다`}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Button title="오늘의 조건 충족 기업 조회" onPress={search} />
              </Card>
            )}
          </>
        )}

        {loading && <LoadingState label="최신 지표와 비교하고 있어요" />}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!!results.length && (
          <View style={styles.results}>
            <Text style={styles.resultTitle}>조건 충족·근접 기업 {results.length}개</Text>
            {results.map((company) => (
              <Pressable
                key={company.securityId}
                onPress={() => router.push(`/stocks/${company.securityId}`)}
              >
                <Card style={styles.companyCard}>
                  <View style={styles.companyCopy}>
                    <Text style={styles.ticker}>{company.ticker}</Text>
                    <Muted>{company.name}</Muted>
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
  sectionLabel: { color: palette.muted, fontSize: 12, fontWeight: '700', marginTop: 5 },
  intervalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  interval: {
    backgroundColor: '#F0F4F5',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  intervalActive: { backgroundColor: '#D9EEE9' },
  intervalText: { color: palette.text, fontSize: 12, fontWeight: '700' },
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
