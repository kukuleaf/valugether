import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { api } from '../lib/api';
import { Button, Card, H1, LoadingState, Muted, Page, palette } from '../components/ui';

type NotificationSettings = {
  custom_company_enabled: boolean;
  email_enabled: boolean;
  email_available: boolean;
  notification_interval_days: number;
  next_notification_at: string | null;
  last_notification_at: string | null;
};

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [intervalDays, setIntervalDays] = useState(1);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const emailAvailable = settings?.email_available ?? false;

  useEffect(() => {
    let active = true;
    setLoadError('');
    api<NotificationSettings>('/presets/notification-settings', undefined, true)
      .then((data) => {
        if (!active) return;
        setSettings(data);
        setEnabled(data.custom_company_enabled);
        setEmailEnabled(data.email_enabled);
        setIntervalDays(data.notification_interval_days);
      })
      .catch((cause: any) => active && setLoadError(cause.message));
    return () => {
      active = false;
    };
  }, [reload]);

  const save = async () => {
    if (!settings || saving) return;
    setSaving(true);
    setMessage('');
    try {
      const data = await api<NotificationSettings>(
        '/presets/notification-settings',
        {
          method: 'PATCH',
          body: JSON.stringify({ enabled, emailEnabled, intervalDays }),
        },
        true,
      );
      setSettings(data);
      setMessage('알림 설정을 저장했습니다.');
    } catch (cause: any) {
      setMessage(cause.message);
    } finally {
      setSaving(false);
    }
  };

  if (loadError)
    return (
      <Page>
        <H1>알림 설정</H1>
        <Card>
          <Muted>{loadError}</Muted>
          <Button title="다시 시도" secondary onPress={() => setReload((current) => current + 1)} />
        </Card>
      </Page>
    );
  if (!settings) return <LoadingState label="알림 설정을 불러오고 있어요" />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Page>
        <H1>알림 설정</H1>
        <Muted>하나의 설정이 저장한 모든 맞춤기업 기준에 일괄 적용됩니다.</Muted>
        <Card>
          <View style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.title}>맞춤 기업 정보 알림</Text>
              <Muted>새로 조건을 충족한 기업이 생기면 알려드립니다.</Muted>
            </View>
            <Switch
              accessibilityLabel="맞춤 기업 정보 알림"
              disabled={saving}
              value={enabled}
              onValueChange={setEnabled}
            />
          </View>
          <Text style={styles.label}>알림 주기</Text>
          <View style={styles.intervals}>
            {[1, 3, 7, 14].map((days) => (
              <Pressable
                key={days}
                accessibilityRole="radio"
                accessibilityState={{
                  selected: intervalDays === days,
                  disabled: !enabled || saving,
                }}
                disabled={!enabled || saving}
                onPress={() => setIntervalDays(days)}
                style={[
                  styles.interval,
                  intervalDays === days && styles.intervalActive,
                  !enabled && styles.disabled,
                ]}
              >
                <Text style={styles.intervalText}>{days === 1 ? '매일' : `${days}일마다`}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.title}>이메일로도 받기</Text>
              <Muted>
                {emailAvailable
                  ? '이메일 인증이 완료된 주소로 새 매칭 결과를 보냅니다.'
                  : '이메일 알림은 현재 준비 중입니다.'}
              </Muted>
            </View>
            <Switch
              accessibilityLabel="맞춤 기업 이메일 알림"
              disabled={!enabled || !emailAvailable || saving}
              value={emailEnabled}
              onValueChange={setEmailEnabled}
            />
          </View>
        </Card>
        <Button title={saving ? '저장 중…' : '알림 설정 저장'} disabled={saving} onPress={save} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </Page>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1 },
  title: { color: palette.text, fontSize: 17, fontWeight: '900' },
  label: { color: palette.muted, fontSize: 12, fontWeight: '700', marginTop: 8 },
  intervals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interval: { backgroundColor: '#F0F4F5', borderRadius: 9, padding: 10 },
  intervalActive: { backgroundColor: '#D9EEE9', borderColor: palette.brand, borderWidth: 1 },
  intervalText: { color: palette.text, fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  message: { color: palette.accent, lineHeight: 21 },
});
