import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Card, H1, Input, LoadingState, Muted, Page, palette } from '../../components/ui';
import { defaultExchangeCodes, ExchangeSelector } from '../../components/ExchangeSelector';
import { api, ScreenCondition, ScreenPreset } from '../../lib/api';
import { getAccess } from '../../lib/session';

type Operator = ScreenCondition['operator'];
type Metric = {
  metric_code: string;
  metric_name_ko: string;
  statement_type: string;
  unit_type: string;
  default_operator: Operator | null;
  basic_search: boolean;
  user_selectable: boolean;
};

const basicMetrics = [
  { code: 'PER', label: '주가수익비율(PER)', value: '15' },
  { code: 'ROE', label: '자기자본이익률(ROE)', value: '10' },
  { code: 'PBR', label: '주가순자산비율(PBR)', value: '1.5' },
  { code: 'EPS_GROWTH_YOY', label: '주당순이익(EPS) 성장률', value: '5' },
];

const descriptions: Record<string, string> = {
  PER: '주가가 회사 이익의 몇 배인지 보여줍니다. 보통 낮을수록 저평가 가능성이 있지만 업종별 차이가 큽니다.',
  ROE: '주주가 맡긴 자본으로 얼마나 이익을 냈는지 보여줍니다. 높을수록 자본 활용이 좋다는 뜻입니다.',
  PBR: '주가가 회사 순자산의 몇 배인지 보여줍니다. 1배 이하면 장부상 순자산보다 주가가 낮다는 뜻입니다.',
  EPS_GROWTH_YOY:
    '주당순이익이 전년보다 얼마나 늘었는지 보여줍니다. 꾸준한 양수 성장이 중요합니다.',
  PROFITABLE_CONSECUTIVE_YEARS: '최근 3개 회계연도의 당기순이익이 모두 0보다 큰 회사를 찾습니다.',
  DEBT_RATIO:
    '자기자본에 비해 부채가 얼마나 있는지 보여줍니다. 일반적으로 낮을수록 재무 부담이 작습니다.',
};

const operatorLabels: Record<Operator, string> = {
  LTE: '이하',
  LT: '미만',
  GTE: '이상',
  GT: '초과',
  EQ: '같음',
  BETWEEN: '범위',
};
const categoryLabels: Record<string, string> = {
  IS: '수익과 비용',
  BS: '자산과 부채',
  CF: '현금 흐름',
  VALUATION: '주가 수준',
  RATIO: '수익성과 안정성',
  GROWTH: '성장성',
  MARKET: '시장 정보',
  DIVIDEND: '배당',
  TREND: '최근 흐름',
};
const unitLabels: Record<string, string> = {
  CURRENCY: '원',
  PER_SHARE: '원',
  PERCENT: '%',
  RATIO: '배',
  COUNT: '년',
  NUMBER: '',
  BOOLEAN: '',
};

export default function Advanced() {
  const params = useLocalSearchParams<{ presetId?: string }>();
  const presetId = Array.isArray(params.presetId) ? params.presetId[0] : params.presetId;
  const [mode, setMode] = useState<'BASIC' | 'DETAIL'>('BASIC');
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(basicMetrics.map((item) => [item.code, item.value])),
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [help, setHelp] = useState<{ title: string; body: string } | null>(null);
  const [noLossThreeYears, setNoLossThreeYears] = useState(false);
  const [useDebtRatio, setUseDebtRatio] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [presetName, setPresetName] = useState('나의 기업 기준');
  const [exchangeCodes, setExchangeCodes] = useState<string[]>([...defaultExchangeCodes]);
  const [operatorOverrides, setOperatorOverrides] = useState<Record<string, Operator>>({});

  useEffect(() => {
    api<Metric[]>('/metrics')
      .then((items) => {
        setMetrics(items.filter((item) => item.user_selectable));
        const categories = [...new Set(items.map((item) => item.statement_type))];
        setExpanded(
          Object.fromEntries(categories.map((category, index) => [category, index === 0])),
        );
      })
      .catch(() => setLoadError('검색 항목을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!presetId) return;
    api<ScreenPreset>(`/presets/${presetId}`, undefined, true)
      .then((preset) => {
        setPresetName(preset.preset_name);
        setMode(preset.search_mode === 'ADVANCED_DETAIL' ? 'DETAIL' : 'BASIC');
        setExchangeCodes(
          preset.exchange_filter_json?.length
            ? preset.exchange_filter_json
            : [...defaultExchangeCodes],
        );
        setValues(
          Object.fromEntries(
            preset.conditions.map((item) => [item.metricCode, String(item.target)]),
          ),
        );
        setOperatorOverrides(
          Object.fromEntries(preset.conditions.map((item) => [item.metricCode, item.operator])),
        );
        setNoLossThreeYears(
          preset.conditions.some((item) => item.metricCode === 'PROFITABLE_CONSECUTIVE_YEARS'),
        );
        setUseDebtRatio(preset.conditions.some((item) => item.metricCode === 'DEBT_RATIO'));
      })
      .catch((cause: any) => setLoadError(cause.message));
  }, [presetId]);

  const metricMap = useMemo(
    () => new Map(metrics.map((metric) => [metric.metric_code, metric])),
    [metrics],
  );
  const categories = useMemo(
    () =>
      [...new Set(metrics.map((metric) => metric.statement_type))].map((category) => ({
        code: category,
        label: categoryLabels[category] ?? '기타 항목',
        metrics: metrics.filter((metric) => metric.statement_type === category),
      })),
    [metrics],
  );

  const condition = (metric: Metric, target: number): ScreenCondition => ({
    metricCode: metric.metric_code,
    operator: operatorOverrides[metric.metric_code] ?? metric.default_operator ?? 'GTE',
    target,
  });

  const buildConditions = () => {
    let conditions: ScreenCondition[] = [];
    if (mode === 'BASIC') {
      conditions = basicMetrics.flatMap((item) => {
        const metric = metricMap.get(item.code);
        const value = values[item.code];
        return metric && value !== '' ? [condition(metric, Number(value))] : [];
      });
      const profitableYears = metricMap.get('PROFITABLE_CONSECUTIVE_YEARS');
      if (noLossThreeYears && profitableYears) conditions.push(condition(profitableYears, 3));
      const debtRatio = metricMap.get('DEBT_RATIO');
      if (useDebtRatio && debtRatio && values.DEBT_RATIO !== '') {
        conditions.push(condition(debtRatio, Number(values.DEBT_RATIO)));
      }
    } else {
      conditions = metrics.flatMap((metric) => {
        const value = values[metric.metric_code];
        return value !== undefined && value !== '' ? [condition(metric, Number(value))] : [];
      });
    }
    if (!conditions.length || conditions.some((item) => !Number.isFinite(item.target))) {
      setHelp({
        title: '검색 기준을 확인해 주세요',
        body: '숫자로 된 검색 기준을 하나 이상 입력해 주세요.',
      });
      return null;
    }
    return conditions;
  };

  const search = () => {
    const conditions = buildConditions();
    if (!conditions) return;
    router.push({
      pathname: '/results',
      params: {
        conditions: JSON.stringify(conditions),
        exchanges: JSON.stringify(exchangeCodes),
      },
    });
  };

  const openSave = async () => {
    if (!(await getAccess())) {
      setHelp({
        title: '로그인이 필요합니다',
        body: '프리셋은 계정에 저장됩니다. 로그인 후 같은 조건을 조건검색과 맞춤기업 탭에서 함께 사용할 수 있습니다.',
      });
      return;
    }
    if (buildConditions()) setSaveOpen(true);
  };

  const savePreset = async () => {
    const conditions = buildConditions();
    if (!conditions || !presetName.trim()) return;
    try {
      const response = await api<{ presetId: number }>(
        presetId ? `/presets/${presetId}` : '/presets',
        {
          method: presetId ? 'PATCH' : 'POST',
          body: JSON.stringify({
            name: presetName.trim(),
            conditions,
            markets: [
              ...(exchangeCodes.some((code) => code === 'KOSPI' || code === 'KOSDAQ')
                ? ['KR']
                : []),
              ...(exchangeCodes.some((code) => code === 'NASDAQ' || code === 'NYSE') ? ['US'] : []),
            ],
            exchanges: exchangeCodes,
            mode: mode === 'BASIC' ? 'ADVANCED_BASIC' : 'ADVANCED_DETAIL',
          }),
        },
        true,
      );
      setSaveOpen(false);
      setHelp({
        title: presetId ? '맞춤기업 기준 수정 완료' : '프리셋 저장 완료',
        body: '맞춤기업에서 상세 조건과 오늘의 조건 충족 기업을 확인할 수 있습니다.',
      });
      if (presetId) router.replace(`/presets/${response.presetId}`);
    } catch (cause: any) {
      setHelp({ title: '저장 실패', body: cause.message });
    }
  };

  const metricInput = (metric: Metric, label?: string, showName = true) => (
    <View key={metric.metric_code} style={styles.metricRow}>
      <View style={styles.metricName}>
        {showName && <Text style={styles.label}>{label ?? metric.metric_name_ko}</Text>}
        <Text style={styles.operator}>{operatorLabels[metric.default_operator ?? 'GTE']}</Text>
      </View>
      {metric.unit_type === 'BOOLEAN' ? (
        <View style={styles.booleanChoices}>
          {[
            ['', '선택 안 함'],
            ['1', '예'],
            ['0', '아니요'],
          ].map(([value, text]) => (
            <Pressable
              key={text}
              onPress={() => setValues((current) => ({ ...current, [metric.metric_code]: value }))}
              style={[
                styles.booleanChoice,
                (values[metric.metric_code] ?? '') === value && styles.booleanChoiceActive,
              ]}
            >
              <Text style={styles.booleanChoiceText}>{text}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          <Input
            accessibilityLabel={`${label ?? metric.metric_name_ko} 기준값`}
            keyboardType="numeric"
            value={values[metric.metric_code] ?? ''}
            onChangeText={(value) =>
              setValues((current) => ({ ...current, [metric.metric_code]: value }))
            }
            placeholder="입력"
            style={styles.input}
          />
          <Text style={styles.unit}>{unitLabels[metric.unit_type] ?? ''}</Text>
        </>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      <Page>
        <H1>조건 검색</H1>
        <Muted>원하는 기준을 정하면 조건에 맞거나 가까운 회사를 찾아드립니다.</Muted>
        <ExchangeSelector selected={exchangeCodes} onChange={setExchangeCodes} />
        <View style={styles.segment}>
          {(['BASIC', 'DETAIL'] as const).map((item) => (
            <Pressable
              key={item}
              onPress={() => setMode(item)}
              style={[styles.segmentItem, mode === item && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, mode === item && styles.segmentTextActive]}>
                {item === 'BASIC' ? '쉬운 검색' : '전체 항목'}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading && <LoadingState label="검색 항목을 준비하고 있어요" />}
        {loadError ? (
          <Card>
            <Text style={styles.error}>{loadError}</Text>
          </Card>
        ) : null}

        {!loading && !loadError && mode === 'BASIC' && (
          <Card>
            {basicMetrics.map((item) => {
              const metric = metricMap.get(item.code);
              if (!metric) return null;
              return (
                <View key={item.code}>
                  <View style={styles.helpLine}>
                    <Text style={styles.label}>{item.label}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${item.label} 설명`}
                      onPress={() => setHelp({ title: item.label, body: descriptions[item.code] })}
                      style={styles.infoButton}
                    >
                      <Text style={styles.infoText}>i</Text>
                    </Pressable>
                  </View>
                  {metricInput(metric, item.label, false)}
                </View>
              );
            })}

            {metricMap.has('PROFITABLE_CONSECUTIVE_YEARS') && (
              <View style={styles.optionRow}>
                <View style={styles.optionText}>
                  <View style={styles.helpLine}>
                    <Text style={styles.label}>최근 3년 연속 흑자</Text>
                    <Info
                      onPress={() =>
                        setHelp({
                          title: '최근 3년 연속 흑자',
                          body: descriptions.PROFITABLE_CONSECUTIVE_YEARS,
                        })
                      }
                    />
                  </View>
                  <Muted>최근 3년 모두 이익을 낸 회사만 보기</Muted>
                </View>
                <Switch value={noLossThreeYears} onValueChange={setNoLossThreeYears} />
              </View>
            )}

            {metricMap.has('DEBT_RATIO') && (
              <View style={styles.optionBlock}>
                <View style={styles.optionRow}>
                  <View style={styles.optionText}>
                    <View style={styles.helpLine}>
                      <Text style={styles.label}>부채비율 제한</Text>
                      <Info
                        onPress={() =>
                          setHelp({
                            title: '부채비율',
                            body: descriptions.DEBT_RATIO,
                          })
                        }
                      />
                    </View>
                    <Muted>설정한 비율 이하인 회사만 보기</Muted>
                  </View>
                  <Switch value={useDebtRatio} onValueChange={setUseDebtRatio} />
                </View>
                {useDebtRatio && metricInput(metricMap.get('DEBT_RATIO')!, '부채비율', false)}
              </View>
            )}
          </Card>
        )}

        {!loading && !loadError && mode === 'DETAIL' && (
          <View style={styles.categoryList}>
            <Muted>
              원하는 항목에만 숫자를 입력하세요. 비워둔 항목은 검색에 사용하지 않습니다.
            </Muted>
            {categories.map((category) => (
              <Card key={category.code}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    setExpanded((current) => ({
                      ...current,
                      [category.code]: !current[category.code],
                    }))
                  }
                  style={styles.categoryHeader}
                >
                  <Text style={styles.categoryTitle}>{category.label}</Text>
                  <Text style={styles.categoryToggle}>
                    {expanded[category.code] ? '접기 ▲' : `펼치기 (${category.metrics.length}) ▼`}
                  </Text>
                </Pressable>
                {expanded[category.code] && category.metrics.map((metric) => metricInput(metric))}
              </Card>
            ))}
          </View>
        )}

        <Button title="회사 찾기" onPress={search} />
        <Button
          title={presetId ? '맞춤기업 기준 수정' : '이 조건을 프리셋으로 저장'}
          secondary
          onPress={openSave}
        />
      </Page>

      <Modal
        visible={Boolean(help)}
        transparent
        animationType="fade"
        onRequestClose={() => setHelp(null)}
      >
        <View style={styles.modalBackdrop}>
          <Card style={styles.helpCard}>
            <Text style={styles.modalTitle}>{help?.title}</Text>
            <Text style={styles.helpBody}>{help?.body}</Text>
            <Button title="확인" onPress={() => setHelp(null)} />
          </Card>
        </View>
      </Modal>

      <Modal
        visible={saveOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSaveOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Card style={styles.helpCard}>
            <Text style={styles.modalTitle}>{presetId ? '맞춤기업 기준 수정' : '프리셋 저장'}</Text>
            <Muted>선택한 시장과 조건이 맞춤기업에 저장됩니다.</Muted>
            <Input
              accessibilityLabel="프리셋 이름"
              value={presetName}
              onChangeText={setPresetName}
              placeholder="프리셋 이름"
            />
            <Button title={presetId ? '수정 저장' : '저장'} onPress={savePreset} />
            <Button title="취소" secondary onPress={() => setSaveOpen(false)} />
          </Card>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Info({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="설명 보기"
      onPress={onPress}
      style={styles.infoButton}
    >
      <Text style={styles.infoText}>i</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: palette.bg },
  scrollContent: { paddingBottom: 30 },
  segment: {
    height: 44,
    flexDirection: 'row',
    backgroundColor: '#EDEFF3',
    borderRadius: 12,
    padding: 3,
  },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  segmentActive: { backgroundColor: 'white' },
  segmentText: { color: palette.muted, fontWeight: '600' },
  segmentTextActive: { color: palette.text },
  helpLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5 },
  infoButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: palette.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: { color: palette.muted, fontSize: 13, fontWeight: '800' },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  metricName: { flex: 1, minWidth: 0 },
  label: { fontSize: 15, fontWeight: '700', color: palette.text },
  operator: { fontSize: 12, color: palette.muted, marginTop: 3 },
  input: { width: 100 },
  unit: { width: 28, color: palette.muted },
  booleanChoices: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 5 },
  booleanChoice: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  booleanChoiceActive: { borderColor: palette.accent, backgroundColor: '#E8F0FF' },
  booleanChoiceText: { color: palette.text, fontSize: 12, fontWeight: '600' },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  optionText: { flex: 1, minWidth: 0 },
  optionBlock: { borderTopWidth: 1, borderTopColor: palette.line },
  categoryList: { gap: 12 },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 42,
  },
  categoryTitle: { fontSize: 17, fontWeight: '800', color: palette.text },
  categoryToggle: { color: palette.accent, fontSize: 13, fontWeight: '700' },
  error: { color: '#A00000', lineHeight: 21 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  helpCard: { maxWidth: 480 },
  modalTitle: { fontSize: 19, fontWeight: '800', color: palette.text },
  helpBody: { color: palette.text, fontSize: 15, lineHeight: 23, marginVertical: 8 },
});
