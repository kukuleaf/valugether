import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, ScreenPreset } from '../../lib/api';
import { Button, Card, H1, LoadingState, Muted, Page, palette } from '../../components/ui';

type Metric = {
  metric_code: string;
  metric_name_ko: string;
  unit_type: string;
};

const operatorLabels: Record<string, string> = {
  LTE: '이하',
  LT: '미만',
  GTE: '이상',
  GT: '초과',
  EQ: '같음',
  BETWEEN: '범위',
};
const unitLabels: Record<string, string> = {
  PERCENT: '%',
  RATIO: '배',
  COUNT: '년',
  CURRENCY: '원',
  PER_SHARE: '원',
};

export default function PresetDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [preset, setPreset] = useState<ScreenPreset | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    setPreset(null);
    setError('');
    Promise.all([api<ScreenPreset>(`/presets/${id}`, undefined, true), api<Metric[]>('/metrics')])
      .then(([presetData, metricData]) => {
        if (!active) return;
        setPreset(presetData);
        setMetrics(metricData);
      })
      .catch((cause: any) => active && setError(cause.message));
    return () => {
      active = false;
    };
  }, [id]);

  const metricMap = useMemo(
    () => new Map(metrics.map((metric) => [metric.metric_code, metric])),
    [metrics],
  );

  if (!preset && !error) return <LoadingState label="맞춤기업 기준을 불러오고 있어요" />;
  if (!preset)
    return (
      <Page>
        <Text style={styles.error}>{error}</Text>
      </Page>
    );

  const deletePreset = async () => {
    if (deleting) return;
    setDeleting(true);
    setConfirmOpen(false);
    setError('');
    try {
      await api(`/presets/${preset.preset_id}`, { method: 'DELETE' }, true);
      router.replace('/custom');
    } catch (cause: any) {
      setError(cause.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Page>
        <H1>{preset.preset_name}</H1>
        <Muted>{preset.description || '저장된 맞춤기업 검색 기준입니다.'}</Muted>
        <Card>
          <Text style={styles.sectionTitle}>대상 시장</Text>
          <Text style={styles.value}>
            {preset.exchange_filter_json?.join(' · ') || '전체 시장'}
          </Text>
        </Card>
        <Card>
          <Text style={styles.sectionTitle}>상세 조건</Text>
          {preset.conditions.map((condition) => {
            const metric = metricMap.get(condition.metricCode);
            const unit = unitLabels[metric?.unit_type ?? ''] ?? '';
            return (
              <View key={`${condition.metricCode}-${condition.operator}`} style={styles.condition}>
                <Text style={styles.conditionName}>
                  {metric?.metric_name_ko ?? condition.metricCode}
                </Text>
                <Text style={styles.conditionValue}>
                  {condition.operator === 'BETWEEN'
                    ? `${condition.target}${unit}~${condition.target2}${unit}`
                    : `${condition.target}${unit} ${operatorLabels[condition.operator]}`}
                </Text>
              </View>
            );
          })}
        </Card>
        <Button
          title="기준 수정"
          secondary
          onPress={() => router.push({ pathname: '/advanced', params: { presetId: String(id) } })}
        />
        <Button
          title={deleting ? '삭제 중…' : '기준 삭제'}
          disabled={deleting}
          secondary
          onPress={() => setConfirmOpen(true)}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Page>
      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Card style={styles.confirmCard}>
            <H1>기준 삭제</H1>
            <Muted>'{preset.preset_name}' 기준을 삭제할까요?</Muted>
            <Button title="삭제" danger onPress={() => void deletePreset()} />
            <Button title="취소" secondary onPress={() => setConfirmOpen(false)} />
          </Card>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: palette.bg },
  content: { paddingBottom: 30 },
  modalBackdrop: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  confirmCard: { width: '100%', maxWidth: 440 },
  sectionTitle: { color: palette.text, fontSize: 16, fontWeight: '900' },
  value: { color: palette.accent, fontSize: 14, fontWeight: '800' },
  condition: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: palette.line,
    paddingVertical: 10,
    gap: 10,
  },
  conditionName: { flex: 1, color: palette.text, fontWeight: '700' },
  conditionValue: { color: palette.accent, fontWeight: '900' },
  error: { color: '#A00000', lineHeight: 21 },
});
