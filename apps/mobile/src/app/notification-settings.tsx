import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { api } from '../lib/api';
import { Button, Card, H1, LoadingState, Muted, Page, palette } from '../components/ui';

type NotificationSettings = {
  custom_company_enabled: boolean;
  notification_interval_days: number;
  next_notification_at: string | null;
  last_notification_at: string | null;
};

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [intervalDays, setIntervalDays] = useState(1);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api<NotificationSettings>('/presets/notification-settings', undefined, true)
      .then((data) => {
        setSettings(data);
        setEnabled(data.custom_company_enabled);
        setIntervalDays(data.notification_interval_days);
      })
      .catch((cause: any) => setMessage(cause.message));
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const data = await api<NotificationSettings>(
        '/presets/notification-settings',
        {
          method: 'PATCH',
          body: JSON.stringify({ enabled, intervalDays }),
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

  if (!settings && !message) return <LoadingState label="알림 설정을 불러오고 있어요" />;

  return (
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
            value={enabled}
            onValueChange={setEnabled}
          />
        </View>
        <Text style={styles.label}>알림 주기</Text>
        <View style={styles.intervals}>
          {[1, 3, 7, 14].map((days) => (
            <Pressable
              key={days}
              disabled={!enabled}
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
        <Button title={saving ? '저장 중…' : '알림 설정 저장'} onPress={save} />
      </Card>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </Page>
  );
}

const styles = StyleSheet.create({
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
