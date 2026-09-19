import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
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

  useEffect(() => {
    Promise.all([api<ScreenPreset>(`/presets/${id}`, undefined, true), api<Metric[]>('/metrics')])
      .then(([presetData, metricData]) => {
        setPreset(presetData);
        setMetrics(metricData);
      })
      .catch((cause: any) => setError(cause.message));
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

  const deletePreset = () => {
    Alert.alert('기준 삭제', `'${preset.preset_name}' 기준을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/presets/${preset.preset_id}`, { method: 'DELETE' }, true);
            router.replace('/custom');
          } catch (cause: any) {
            setError(cause.message);
          }
        },
      },
    ]);
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
          title="오늘의 조건 충족 기업 조회"
          onPress={() =>
            router.push({
              pathname: '/results',
              params: {
                conditions: JSON.stringify(preset.conditions),
                exchanges: JSON.stringify(preset.exchange_filter_json),
              },
            })
          }
        />
        <Button
          title="기준 수정"
          secondary
          onPress={() => router.push({ pathname: '/advanced', params: { presetId: String(id) } })}
        />
        <Button title="기준 삭제" secondary onPress={deletePreset} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Page>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: palette.bg },
  content: { paddingBottom: 30 },
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
