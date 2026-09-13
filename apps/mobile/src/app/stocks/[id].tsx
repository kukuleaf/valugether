import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, LoadingState, Muted, Page, palette } from '../../components/ui';
import { PersistentTabBar } from '../../components/PersistentTabBar';
import { api } from '../../lib/api';

type MetricHistory = {
  period_type: string;
  fiscal_year: number | null;
  fiscal_quarter: number | null;
  start_date: string | null;
  end_date: string;
  filing_date: string | null;
  report_type: string | null;
  consolidation_code: string | null;
  numeric_value: string | number | null;
  text_value: string | null;
  currency_code: string | null;
  unit_code: string | null;
  source_type: string;
  provider_name: string | null;
  is_restated: boolean;
};

type Metric = {
  metric_code: string;
  metric_name_ko: string;
  metric_name_en: string | null;
  statement_type: string;
  value_type: string;
  unit_type: string;
  direction_code: string | null;
  formula_text: string | null;
  description: string | null;
  numeric_value: string | number | null;
  text_value: string | null;
  as_of_date: string | null;
  source_type: string | null;
  calculation_version: string | null;
  history: MetricHistory[];
};

type Price = {
  trade_date: string;
  open_price: string | number | null;
  high_price: string | number | null;
  low_price: string | number | null;
  close_price: string | number;
  adjusted_close: string | number | null;
  volume: string | number | null;
  currency_code: string | null;
  provider_name: string;
  fetched_at?: string;
};

type Dividend = {
  ex_date: string;
  payment_date: string | null;
  amount_per_share: string | number | null;
  currency_code: string | null;
  event_status: string | null;
  provider_name: string | null;
};

type Split = {
  ex_date: string;
  split_from: string | number;
  split_to: string | number;
  provider_name: string | null;
};

type StockDetail = {
  security_id: number;
  ticker: string;
  security_name: string;
  security_type: string;
  currency_code: string;
  isin: string | null;
  listing_date: string | null;
  delisting_date: string | null;
  is_active: boolean;
  legal_name: string;
  company_name: string;
  country_code: string;
  dart_corp_code: string | null;
  sec_cik: string | null;
  industry_code: string | null;
  sector_code: string | null;
  is_financial: boolean;
  website_url: string | null;
  market_code: string;
  exchange_code: string;
  mic: string | null;
  exchange_name: string;
  exchange_country_code: string;
  exchange_currency_code: string;
  timezone_name: string;
  latest_price: Price | null;
  price_history: Price[];
  metrics: Metric[];
  dividends: Dividend[];
  splits: Split[];
};

const categoryLabels: Record<string, string> = {
  IS: '수익과 비용',
  BS: '자산과 부채',
  CF: '현금 흐름',
  VALUATION: '주가 수준',
  RATIO: '수익성과 안정성',
  GROWTH: '성장성',
  MARKET: '시장 정보',
  DIVIDEND: '배당 지표',
  TREND: '최근 흐름',
};

const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  IS: 'receipt-outline',
  BS: 'scale-outline',
  CF: 'swap-horizontal-outline',
  VALUATION: 'pricetag-outline',
  RATIO: 'pie-chart-outline',
  GROWTH: 'trending-up-outline',
  MARKET: 'stats-chart-outline',
  DIVIDEND: 'cash-outline',
  TREND: 'time-outline',
};

const marketLabels: Record<string, string> = { KR: '한국', US: '미국' };
const tabs = [
  { code: 'overview', label: '개요' },
  { code: 'financial', label: '재무제표' },
  { code: 'indicators', label: '투자지표' },
  { code: 'dividend', label: '배당' },
] as const;
type DetailTab = (typeof tabs)[number]['code'];
type PeriodMode = 'QUARTER' | 'ANNUAL' | 'ALL';

export default function StockDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [stock, setStock] = useState<StockDetail | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [profileOpen, setProfileOpen] = useState(false);
  const [periodMode, setPeriodMode] = useState<PeriodMode>('QUARTER');
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const [priceChartOpen, setPriceChartOpen] = useState(false);
  const [priceRange, setPriceRange] = useState('6M');
  const [chartPrices, setChartPrices] = useState<Price[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState('');

  useEffect(() => {
    api<StockDetail>(`/stocks/${id}`)
      .then(setStock)
      .catch(() => setError('기업정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'));
  }, [id]);

  useEffect(() => {
    if (!priceChartOpen) return;
    setChartLoading(true);
    setChartError('');
    api<{ prices: Price[] }>(`/stocks/${id}/prices?range=${priceRange}`)
      .then((result) => setChartPrices(result.prices))
      .catch(() => {
        setChartPrices([]);
        setChartError('선택 기간의 시세를 불러오지 못했습니다.');
      })
      .finally(() => setChartLoading(false));
  }, [id, priceChartOpen, priceRange]);

  const groups = useMemo(() => {
    if (!stock) return [];
    return [...new Set(stock.metrics.map((metric) => metric.statement_type))].map((code) => ({
      code,
      title: categoryLabels[code] ?? '기타 정보',
      metrics: stock.metrics.filter((metric) => metric.statement_type === code),
    }));
  }, [stock]);

  if (!stock && !error) {
    return (
      <View style={styles.screenShell}>
        <Page>
          <LoadingState label="기업정보를 정리하고 있어요" />
        </Page>
        <PersistentTabBar />
      </View>
    );
  }

  if (error || !stock) {
    return (
      <View style={styles.screenShell}>
        <Page>
          <Card>
            <Text style={styles.error}>{error}</Text>
          </Card>
        </Page>
        <PersistentTabBar />
      </View>
    );
  }

  const profileRows: Array<[string, string | boolean | null]> = [
    ['정식 회사명', stock.legal_name],
    ['종목 종류', securityTypeLabel(stock.security_type)],
    ['거래소', stock.exchange_name],
    ['거래소 코드', stock.exchange_code],
    ['국가', countryLabel(stock.country_code)],
    ['통화', stock.currency_code],
    ['업종', stock.industry_code],
    ['산업군', stock.sector_code],
    ['상장일', shortDate(stock.listing_date)],
    ['상장 상태', stock.is_active ? '상장 중' : '상장 종료'],
    ['금융회사', stock.is_financial ? '예' : '아니요'],
    ['ISIN', stock.isin],
    ['DART 고유번호', stock.dart_corp_code],
    ['SEC CIK', stock.sec_cik],
    ['웹사이트', stock.website_url],
    ['거래소 표준코드', stock.mic],
    ['거래소 시간대', stock.timezone_name],
  ];
  const change = priceChange(stock.price_history);

  return (
    <View style={styles.screenShell}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
        <Page>
          <LinearGradient colors={['#123E58', '#176B87']} style={styles.hero}>
            <View style={styles.heroFavorite}>
              <Ionicons name="heart-outline" size={21} color="#D9FFF4" />
            </View>
            <View style={styles.heroIcon}>
              <Ionicons name="business" size={25} color="#176B87" />
            </View>
            <Text style={styles.ticker}>{stock.ticker}</Text>
            <Text style={styles.name}>{stock.security_name}</Text>
            {stock.latest_price && (
              <Text style={styles.heroPrice}>
                {money(stock.latest_price.close_price, stock.latest_price.currency_code)}
              </Text>
            )}
            {change && (
              <Text style={[styles.heroChange, change.positive ? styles.rise : styles.fall]}>
                {change.label}
              </Text>
            )}
            <View style={styles.marketBadge}>
              <Ionicons name="location-outline" size={14} color="#D9FFF4" />
              <Text style={styles.marketText}>
                {marketLabels[stock.market_code] ?? stock.market_code} 시장
              </Text>
            </View>
          </LinearGradient>

          <View style={styles.tabBar}>
            {tabs.map((tab) => (
              <Pressable
                key={tab.code}
                onPress={() => setActiveTab(tab.code)}
                style={[styles.tab, activeTab === tab.code && styles.tabActive]}
              >
                <Text style={[styles.tabText, activeTab === tab.code && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.dataSummary}>
            <View>
              <Text style={styles.dataSummaryTitle}>
                {activeTab === 'financial'
                  ? '재무제표'
                  : activeTab === 'indicators'
                    ? '투자지표'
                    : activeTab === 'dividend'
                      ? '배당정보'
                      : '기업개요'}
              </Text>
              <Text style={styles.dataSummaryMeta}>
                {activeTab === 'overview'
                  ? '기본 정보 · 최근 시세'
                  : `${periodMode === 'QUARTER' ? '최근 4개 분기' : periodMode === 'ANNUAL' ? '최근 4개 연도' : '분기·연간 전체'} · ${tabMetricCount(groups, activeTab)}개 지표`}
              </Text>
            </View>
            {activeTab !== 'overview' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="표시 기간 선택"
                onPress={() => setPeriodMenuOpen(true)}
                style={({ pressed }) => [styles.periodPill, pressed && styles.pressed]}
              >
                <Text style={styles.periodPillText}>
                  {periodMode === 'QUARTER' ? '분기별' : periodMode === 'ANNUAL' ? '연간' : '전체'}
                </Text>
                <Ionicons name="chevron-down" size={13} color={palette.accent} />
              </Pressable>
            )}
          </View>

          {activeTab === 'overview' && (
            <>
              <ExpandableCard
                title="기업 기본정보"
                icon="business-outline"
                open={profileOpen}
                onPress={() => setProfileOpen((value) => !value)}
                summary={`${stock.exchange_name} · ${stock.currency_code}`}
              >
                {profileRows.map(([label, value]) => (
                  <InfoRow key={label} label={label} value={String(value ?? '정보 없음')} />
                ))}
              </ExpandableCard>

              {stock.latest_price && (
                <Card>
                  <SectionHeader icon="pulse-outline" title="최근 주가" />
                  <View style={styles.priceHeadline}>
                    <View>
                      <Text style={styles.priceValue}>
                        {money(stock.latest_price.close_price, stock.latest_price.currency_code)}
                      </Text>
                      <Text style={styles.date}>{dateLabel(stock.latest_price.trade_date)}</Text>
                    </View>
                    <Text style={styles.provider}>{stock.latest_price.provider_name}</Text>
                  </View>
                  <View style={styles.priceGrid}>
                    <PriceCell label="시가" value={stock.latest_price.open_price} />
                    <PriceCell label="고가" value={stock.latest_price.high_price} />
                    <PriceCell label="저가" value={stock.latest_price.low_price} />
                    <PriceCell label="수정 종가" value={stock.latest_price.adjusted_close} />
                    <PriceCell label="거래량" value={stock.latest_price.volume} />
                  </View>
                  {stock.price_history.length > 1 && (
                    <Pressable style={styles.inlineButton} onPress={() => setPriceChartOpen(true)}>
                      <Text style={styles.inlineButtonText}>주가 차트 보기</Text>
                      <Ionicons name="stats-chart" size={17} color={palette.accent} />
                    </Pressable>
                  )}
                </Card>
              )}
            </>
          )}

          {activeTab === 'financial' && (
            <MetricGroups
              groups={groups.filter((group) => ['IS', 'BS', 'CF'].includes(group.code))}
              currency={stock.currency_code}
              periodMode={periodMode}
            />
          )}

          {activeTab === 'indicators' && (
            <MetricGroups
              groups={groups.filter((group) =>
                ['VALUATION', 'RATIO', 'GROWTH', 'MARKET', 'TREND'].includes(group.code),
              )}
              currency={stock.currency_code}
              periodMode={periodMode}
            />
          )}

          {activeTab === 'dividend' && (
            <>
              <MetricGroups
                groups={groups.filter((group) => group.code === 'DIVIDEND')}
                currency={stock.currency_code}
                periodMode={periodMode}
              />
              {!!stock.dividends.length && (
                <Card>
                  <SectionHeader
                    icon="cash-outline"
                    title="배당 내역"
                    count={stock.dividends.length}
                  />
                  {stock.dividends.map((dividend, index) => (
                    <View key={`${dividend.ex_date}-${index}`} style={styles.historyRow}>
                      <View>
                        <Text style={styles.historyPeriod}>
                          {shortDate(dividend.ex_date)} 배당락
                        </Text>
                        <Text style={styles.historyMeta}>
                          지급일 {shortDate(dividend.payment_date)} ·{' '}
                          {dividend.provider_name ?? '출처 없음'}
                        </Text>
                      </View>
                      <Text style={styles.historyValue}>
                        {money(dividend.amount_per_share, dividend.currency_code)}
                      </Text>
                    </View>
                  ))}
                </Card>
              )}
            </>
          )}

          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={18} color={palette.muted} />
            <Text style={styles.noticeText}>
              표를 좌우로 밀어 분기별 값을 비교할 수 있습니다. 자료가 없으면 최신값만 표시됩니다.
            </Text>
          </View>
        </Page>
      </ScrollView>
      <PersistentTabBar />

      <PeriodMenu
        visible={periodMenuOpen}
        selected={periodMode}
        onSelect={(value) => {
          setPeriodMode(value);
          setPeriodMenuOpen(false);
        }}
        onClose={() => setPeriodMenuOpen(false)}
      />
      <PriceChartModal
        visible={priceChartOpen}
        prices={chartPrices.length ? chartPrices : stock.price_history}
        range={priceRange}
        loading={chartLoading}
        error={chartError}
        onRange={setPriceRange}
        onClose={() => setPriceChartOpen(false)}
        currency={stock.currency_code}
      />
    </View>
  );
}

function MetricGroups({
  groups,
  currency,
  periodMode,
}: {
  groups: Array<{ code: string; title: string; metrics: Metric[] }>;
  currency: string;
  periodMode: PeriodMode;
}) {
  if (!groups.length) {
    return (
      <Card>
        <Muted>아직 표시할 자료가 없습니다.</Muted>
      </Card>
    );
  }

  return (
    <>
      {groups.map((group) => (
        <MetricTable
          key={group.code}
          title={group.title}
          icon={categoryIcons[group.code] ?? 'analytics-outline'}
          metrics={group.metrics}
          currency={currency}
          periodMode={periodMode}
        />
      ))}
    </>
  );
}

function MetricTable({
  title,
  icon,
  metrics,
  currency,
  periodMode,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  metrics: Metric[];
  currency: string;
  periodMode: PeriodMode;
}) {
  const periods = metricPeriods(metrics, periodMode);
  const [chartMetricCode, setChartMetricCode] = useState<string | null>(null);
  const chartMetric = metrics.find((metric) => metric.metric_code === chartMetricCode) ?? null;
  return (
    <Card style={styles.tableCard}>
      <View style={styles.tableTitleRow}>
        <View style={styles.tableHeading}>
          <SectionHeader icon={icon} title={title} count={metrics.length} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${title} 그래프 보기`}
            onPress={() => setChartMetricCode(metrics[0]?.metric_code ?? null)}
            style={styles.chartButton}
          >
            <Ionicons name="bar-chart-outline" size={16} color={palette.accent} />
            <Text style={styles.chartButtonText}>그래프</Text>
          </Pressable>
        </View>
        <Text style={styles.unitNote}>금액 단위: {currency}</Text>
      </View>
      <View style={styles.frozenTable}>
        <View style={styles.labelColumn}>
          <View style={[styles.tableCell, styles.metricLabelCell, styles.tableHeader]}>
            <Text style={styles.tableHeaderText}>항목</Text>
          </View>
          {metrics.map((metric) => (
            <Pressable
              key={metric.metric_code}
              onPress={() => setChartMetricCode(metric.metric_code)}
              style={[styles.tableCell, styles.metricLabelCell]}
            >
              <View style={styles.metricLabelLine}>
                <Text numberOfLines={2} style={styles.tableMetricName}>
                  {metric.metric_name_ko}
                </Text>
                <Ionicons name="stats-chart-outline" size={11} color={palette.muted} />
              </View>
              <Text style={styles.tableMetricUnit}>{unitLabel(metric.unit_type, currency)}</Text>
            </Pressable>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
          <View>
            <View style={[styles.tableRow, styles.tableHeader]}>
              {periods.map((period) => (
                <View key={period.key} style={[styles.tableCell, styles.valueCell]}>
                  <Text style={styles.tableHeaderText}>{period.label}</Text>
                </View>
              ))}
            </View>
            {metrics.map((metric) => (
              <View key={metric.metric_code} style={styles.tableRow}>
                {periods.map((period) => {
                  const value = metricValueAt(metric, period.date);
                  const numeric = value?.numeric_value == null ? null : Number(value.numeric_value);
                  return (
                    <View key={period.key} style={[styles.tableCell, styles.valueCell]}>
                      <Text
                        style={[
                          styles.tableValue,
                          numeric != null && numeric < 0 && styles.tableValueNegative,
                        ]}
                      >
                        {compactValue(value, metric.unit_type)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
      <Text style={styles.swipeHint}>좌우로 밀어 이전 분기 확인</Text>
      <MetricChartModal
        metric={chartMetric}
        currency={currency}
        onClose={() => setChartMetricCode(null)}
      />
    </Card>
  );
}

function PeriodMenu({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: PeriodMode;
  onSelect: (value: PeriodMode) => void;
  onClose: () => void;
}) {
  const choices: Array<{ value: PeriodMode; label: string; detail: string }> = [
    { value: 'QUARTER', label: '분기별', detail: '최근 4개 분기' },
    { value: 'ANNUAL', label: '연간', detail: '최근 4개 연도' },
    { value: 'ALL', label: '전체', detail: '분기·연간 자료 함께 보기' },
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View style={styles.periodMenu}>
          <Text style={styles.modalTitle}>표시 기간</Text>
          {choices.map((choice) => (
            <Pressable
              key={choice.value}
              onPress={() => onSelect(choice.value)}
              style={[styles.periodChoice, selected === choice.value && styles.periodChoiceActive]}
            >
              <View style={styles.periodChoiceCopy}>
                <Text style={styles.periodChoiceTitle}>{choice.label}</Text>
                <Text style={styles.periodChoiceDetail}>{choice.detail}</Text>
              </View>
              {selected === choice.value && (
                <Ionicons name="checkmark-circle" size={21} color={palette.accent} />
              )}
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

function PriceChartModal({
  visible,
  prices,
  range,
  loading,
  error,
  onRange,
  onClose,
  currency,
}: {
  visible: boolean;
  prices: Price[];
  range: string;
  loading: boolean;
  error: string;
  onRange: (range: string) => void;
  onClose: () => void;
  currency: string;
}) {
  const points = downsample(
    [...prices]
      .reverse()
      .map((price) => ({ label: compactDate(price.trade_date), value: Number(price.close_price) }))
      .filter((point) => Number.isFinite(point.value)),
    48,
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.chartSheet}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>주가 흐름</Text>
              <Text style={styles.chartUnit}>종가 · {currency}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={palette.text} />
            </Pressable>
          </View>
          <View style={styles.rangeRow}>
            {['1M', '3M', '6M', '1Y', '3Y', '5Y'].map((item) => (
              <Pressable
                key={item}
                onPress={() => onRange(item)}
                style={[styles.rangeButton, range === item && styles.rangeButtonActive]}
              >
                <Text style={[styles.rangeText, range === item && styles.rangeTextActive]}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
          {loading ? (
            <LoadingState label="시세를 불러오고 있어요" />
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : points.length > 1 ? (
            <BarChart points={points} />
          ) : (
            <Muted>선택 기간의 시세가 부족합니다.</Muted>
          )}
          <Text style={styles.chartFootnote}>
            {points.length}개 표시 · 서버에 저장된 일별 시세 기준
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function MetricChartModal({
  metric,
  currency,
  onClose,
}: {
  metric: Metric | null;
  currency: string;
  onClose: () => void;
}) {
  const points = metric
    ? metric.history
        .map((history) => ({
          label: compactDate(history.end_date),
          value: Number(history.numeric_value),
        }))
        .filter((point) => Number.isFinite(point.value))
        .reverse()
        .slice(-12)
    : [];
  return (
    <Modal visible={Boolean(metric)} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.chartSheet}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeadingCopy}>
              <Text style={styles.modalTitle}>{metric?.metric_name_ko}</Text>
              <Text style={styles.chartUnit}>
                {metric ? unitLabel(metric.unit_type, currency) : ''} · 최근 {points.length}개
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={palette.text} />
            </Pressable>
          </View>
          {points.length > 1 ? (
            <BarChart points={points} />
          ) : (
            <Muted>그래프용 이력이 부족합니다.</Muted>
          )}
        </View>
      </View>
    </Modal>
  );
}

function BarChart({ points }: { points: Array<{ label: string; value: number }> }) {
  const max = Math.max(...points.map((point) => Math.abs(point.value)), 1);
  const showValues = points.length <= 12;
  return (
    <View>
      <View style={styles.barChart}>
        {points.map((point, index) => (
          <View key={`${point.label}-${index}`} style={styles.barSlot}>
            {showValues && (
              <Text numberOfLines={1} style={styles.barValue}>
                {compactNumber(point.value)}
              </Text>
            )}
            <View
              style={[
                styles.bar,
                { height: Math.max(5, (Math.abs(point.value) / max) * 150) },
                point.value < 0 && styles.negativeBar,
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.chartAxis}>
        <Text style={styles.axisText}>{points[0]?.label}</Text>
        <Text style={styles.axisText}>{points.at(-1)?.label}</Text>
      </View>
    </View>
  );
}

function downsample<T>(items: T[], maxPoints: number) {
  if (items.length <= maxPoints) return items;
  const step = (items.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => items[Math.round(index * step)]);
}

function compactNumber(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1)}조`;
  if (absolute >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억`;
  if (absolute >= 10_000) return `${(value / 10_000).toFixed(1)}만`;
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
}

function metricPeriods(metrics: Metric[], mode: PeriodMode) {
  const dates = new Set<string>();
  for (const metric of metrics) {
    const histories = metric.history.filter((history) => matchesPeriod(history, mode));
    for (const history of histories) dates.add(history.end_date.slice(0, 10));
    if (!histories.length && metric.as_of_date) dates.add(metric.as_of_date.slice(0, 10));
  }
  if (!dates.size) return [{ key: 'current', date: '', label: '현재' }];
  return [...dates]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 4)
    .map((date) => ({ key: date, date, label: compactDate(date) }));
}

function tabMetricCount(groups: Array<{ code: string; metrics: Metric[] }>, tab: DetailTab) {
  const codes =
    tab === 'financial'
      ? ['IS', 'BS', 'CF']
      : tab === 'indicators'
        ? ['VALUATION', 'RATIO', 'GROWTH', 'MARKET', 'TREND']
        : ['DIVIDEND'];
  return groups
    .filter((group) => codes.includes(group.code))
    .reduce((total, group) => total + group.metrics.length, 0);
}

function matchesPeriod(history: MetricHistory, mode: PeriodMode) {
  if (mode === 'ALL') return true;
  const annual = ['FY', 'ANNUAL'].includes(history.period_type) && !history.fiscal_quarter;
  return mode === 'ANNUAL' ? annual : !annual;
}

function metricValueAt(metric: Metric, date: string) {
  if (!date || metric.as_of_date?.slice(0, 10) === date) return metric;
  return metric.history.find((history) => history.end_date.slice(0, 10) === date) ?? null;
}

function compactValue(
  value: Pick<Metric, 'numeric_value' | 'text_value'> | null,
  unitType: string,
) {
  if (!value || value.numeric_value == null) return value?.text_value ?? '-';
  const parsed = Number(value.numeric_value);
  if (!Number.isFinite(parsed)) return String(value.numeric_value);
  if (unitType === 'BOOLEAN') return parsed ? '예' : '아니요';
  const formatted = parsed.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  if (unitType === 'PERCENT') return `${formatted}%`;
  if (unitType === 'RATIO') return `${formatted}배`;
  return formatted;
}

function compactDate(value: string) {
  const [year, month, day] = value.split('-');
  return `${year.slice(2)}.${month}.${day}`;
}

function priceChange(prices: Price[]) {
  if (prices.length < 2) return null;
  const current = Number(prices[0].close_price);
  const previous = Number(prices[1].close_price);
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  const difference = current - previous;
  const percent = (difference / previous) * 100;
  const sign = difference > 0 ? '+' : '';
  return {
    positive: difference >= 0,
    label: `${sign}${difference.toLocaleString('ko-KR', { maximumFractionDigits: 2 })} (${sign}${percent.toFixed(2)}%)`,
  };
}

function unitLabel(unitType: string, currency: string) {
  const labels: Record<string, string> = {
    CURRENCY: currency,
    PER_SHARE: `주당 · ${currency}`,
    PERCENT: '%',
    RATIO: '배',
    COUNT: '개',
    BOOLEAN: '여부',
    NUMBER: '수치',
  };
  return labels[unitType] ?? unitType;
}

function ExpandableCard({
  title,
  icon,
  open,
  onPress,
  summary,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  open: boolean;
  onPress: () => void;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <Pressable style={styles.expandHeader} onPress={onPress}>
        <View style={styles.categoryIcon}>
          <Ionicons name={icon} size={19} color={palette.accent} />
        </View>
        <View style={styles.expandCopy}>
          <Text style={styles.categoryTitle}>{title}</Text>
          <Text style={styles.date}>{summary}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={19} color={palette.muted} />
      </Pressable>
      {open && <View style={styles.infoBox}>{children}</View>}
    </Card>
  );
}

function SectionHeader({
  icon,
  title,
  count,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  count?: number;
}) {
  return (
    <View style={styles.categoryHeader}>
      <View style={styles.categoryIcon}>
        <Ionicons name={icon} size={19} color={palette.accent} />
      </View>
      <Text style={styles.categoryTitle}>{title}</Text>
      {count != null && <Text style={styles.categoryCount}>{count}</Text>}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function PriceCell({ label, value }: { label: string; value: string | number | null }) {
  return (
    <View style={styles.priceCell}>
      <Text style={styles.priceCellLabel}>{label}</Text>
      <Text style={styles.priceCellValue}>{numberLabel(value)}</Text>
    </View>
  );
}

function currentMetricValue(metric: Metric): MetricHistory | null {
  if (metric.numeric_value != null || metric.text_value != null) return null;
  return metric.history[0] ?? null;
}

function valueLabel(
  value: Pick<Metric, 'numeric_value' | 'text_value'>,
  unitType: string,
  currency: string,
) {
  if (value.numeric_value == null) return value.text_value ?? '-';
  const number = numberLabel(value.numeric_value);
  if (unitType === 'PERCENT') return `${number}%`;
  if (unitType === 'RATIO') return `${number}배`;
  if (unitType === 'CURRENCY' || unitType === 'PER_SHARE') return `${number} ${currency}`;
  if (unitType === 'BOOLEAN') return Number(value.numeric_value) ? '예' : '아니요';
  return number;
}

function periodLabel(history: MetricHistory) {
  const year = history.fiscal_year ?? new Date(history.end_date).getFullYear();
  if (history.fiscal_quarter) return `${year}년 ${history.fiscal_quarter}분기`;
  if (/^Q[1-4]$/.test(history.period_type)) {
    return `${year}년 ${history.period_type.slice(1)}분기`;
  }
  if (history.period_type === 'TTM') return `${year}년 최근 12개월`;
  if (history.period_type === 'FY') return `${year}년 연간`;
  return `${year}년 ${periodTypeLabel(history.period_type)}`;
}

function historyDetail(history: MetricHistory) {
  const items = [
    history.consolidation_code === 'CFS'
      ? '연결'
      : history.consolidation_code === 'OFS'
        ? '별도'
        : null,
    history.filing_date ? `공시 ${shortDate(history.filing_date)}` : null,
    history.is_restated ? '수정 공시' : null,
    history.provider_name,
  ];
  return items.filter(Boolean).join(' · ') || `${shortDate(history.end_date)} 기준`;
}

function periodTypeLabel(value: string) {
  const labels: Record<string, string> = {
    QUARTER: '분기',
    HALF: '반기',
    ANNUAL: '연간',
    LATEST: '최신',
  };
  return labels[value] ?? value;
}

function securityTypeLabel(value: string) {
  const labels: Record<string, string> = {
    COMMON_STOCK: '보통주',
    PREFERRED_STOCK: '우선주',
    ETF: '상장지수펀드',
  };
  return labels[value] ?? value;
}

function countryLabel(value: string) {
  return { KR: '대한민국', US: '미국' }[value] ?? value;
}

function numberLabel(value: string | number | null) {
  if (value == null || value === '') return '-';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString('ko-KR') : String(value);
}

function money(value: string | number | null, currency: string | null) {
  return `${numberLabel(value)}${currency ? ` ${currency}` : ''}`;
}

function shortDate(value: string | null) {
  if (!value) return '정보 없음';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ko-KR');
}

function dateLabel(value: string) {
  return `${shortDate(value)} 기준`;
}

const styles = StyleSheet.create({
  screenShell: { flex: 1, backgroundColor: palette.bg },
  screen: { backgroundColor: palette.bg },
  scrollContent: { alignItems: 'center', paddingBottom: 30 },
  hero: { borderRadius: 24, padding: 21, overflow: 'hidden' },
  heroFavorite: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D9FFF4',
    marginBottom: 14,
  },
  ticker: { color: 'white', fontSize: 29, fontWeight: '900' },
  name: { color: '#D5E8ED', fontSize: 15, marginTop: 4 },
  heroPrice: { color: 'white', fontSize: 21, fontWeight: '900', marginTop: 12 },
  heroChange: { fontSize: 12, fontWeight: '800', marginTop: 3 },
  rise: { color: '#FFD3CD' },
  fall: { color: '#C9E6FF' },
  marketBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 14,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  marketText: { color: '#D9FFF4', fontSize: 12, fontWeight: '700' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 5,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: palette.accent },
  tabText: { color: palette.muted, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: palette.accent, fontWeight: '900' },
  dataSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 3,
  },
  dataSummaryTitle: { color: palette.text, fontSize: 21, fontWeight: '900' },
  dataSummaryMeta: { color: palette.muted, fontSize: 11, marginTop: 3 },
  periodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#E8F2F5',
  },
  periodPillText: { color: palette.accent, fontSize: 12, fontWeight: '800' },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 3,
  },
  summaryCopy: { flex: 1 },
  summaryTitle: { color: palette.text, fontSize: 19, fontWeight: '900', marginBottom: 3 },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#E4F7F1',
  },
  count: { color: '#16876C', fontSize: 18, fontWeight: '900' },
  countLabel: { color: '#16876C', fontSize: 11, marginLeft: 2 },
  categoryHeader: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, paddingBottom: 5 },
  categoryIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F2F5',
  },
  categoryTitle: { flex: 1, color: palette.text, fontSize: 17, fontWeight: '900' },
  categoryCount: { color: palette.muted, fontSize: 12 },
  tableCard: { paddingHorizontal: 0, paddingBottom: 10, overflow: 'hidden' },
  tableTitleRow: { paddingHorizontal: 16, paddingTop: 8 },
  tableHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 9,
    backgroundColor: '#E8F2F5',
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  chartButtonText: { color: palette.accent, fontSize: 11, fontWeight: '800' },
  unitNote: { color: palette.muted, fontSize: 10, textAlign: 'right', marginBottom: 6 },
  frozenTable: { width: '100%', flexDirection: 'row' },
  labelColumn: { width: 116, zIndex: 1, backgroundColor: palette.surface },
  tableScroll: {
    flex: 1,
    width: Platform.OS === 'web' ? ('calc(100% - 116px)' as any) : undefined,
  },
  tableHeader: { backgroundColor: '#F1F6F7' },
  tableRow: { flexDirection: 'row' },
  tableCell: {
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: palette.line,
  },
  metricLabelCell: { width: 116, paddingHorizontal: 7 },
  valueCell: { width: 92, alignItems: 'flex-end' },
  tableHeaderText: { color: palette.muted, fontSize: 11, fontWeight: '800' },
  tableMetricName: { color: palette.text, fontSize: 12, fontWeight: '800' },
  metricLabelLine: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tableMetricUnit: { color: palette.muted, fontSize: 9, marginTop: 3 },
  tableValue: { color: palette.text, fontSize: 12, fontWeight: '700' },
  tableValueNegative: { color: '#2878D0' },
  swipeHint: { color: palette.muted, fontSize: 10, textAlign: 'right', padding: 9 },
  expandHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 42 },
  expandCopy: { flex: 1 },
  infoBox: { borderTopWidth: 1, borderTopColor: palette.line, marginTop: 6 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  infoLabel: { color: palette.muted, fontSize: 13 },
  infoValue: { flex: 1, color: palette.text, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  priceHeadline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  priceValue: { color: palette.text, fontSize: 24, fontWeight: '900' },
  provider: {
    color: '#16876C',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#E4F7F1',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  priceCell: {
    width: '31%',
    minWidth: 82,
    backgroundColor: '#F3F7F8',
    borderRadius: 10,
    padding: 9,
  },
  priceCellLabel: { color: palette.muted, fontSize: 10 },
  priceCellValue: { color: palette.text, fontSize: 13, fontWeight: '800', marginTop: 3 },
  inlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 7,
    paddingVertical: 9,
  },
  inlineButtonText: { color: palette.accent, fontSize: 13, fontWeight: '800' },
  metricBlock: { borderTopWidth: 1, borderTopColor: palette.line },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 60,
  },
  pressed: { opacity: 0.65 },
  metricNameBox: { flex: 1, minWidth: 0 },
  metricName: { color: palette.text, fontSize: 14, fontWeight: '700' },
  date: { color: palette.muted, fontSize: 11, marginTop: 3 },
  metricValueBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricValue: { color: palette.accent, fontSize: 15, fontWeight: '800', textAlign: 'right' },
  historyBox: {
    backgroundColor: '#F7FAFA',
    borderRadius: 11,
    paddingHorizontal: 10,
    marginBottom: 9,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 52,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  historyCopy: { flex: 1 },
  historyPeriod: { color: palette.text, fontSize: 12, fontWeight: '800' },
  historyMeta: { color: palette.muted, fontSize: 10, marginTop: 3 },
  historyValue: { color: palette.accent, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  error: { color: '#A00000', lineHeight: 22 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingHorizontal: 4 },
  noticeText: { flex: 1, color: palette.muted, fontSize: 11, lineHeight: 17 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.38)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  periodMenu: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    backgroundColor: palette.surface,
    padding: 18,
    gap: 7,
  },
  modalTitle: { color: palette.text, fontSize: 20, fontWeight: '900' },
  periodChoice: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  periodChoiceActive: { backgroundColor: '#E8F2F5' },
  periodChoiceCopy: { flex: 1 },
  periodChoiceTitle: { color: palette.text, fontSize: 15, fontWeight: '800' },
  periodChoiceDetail: { color: palette.muted, fontSize: 11, marginTop: 2 },
  chartSheet: {
    width: '100%',
    maxWidth: 620,
    borderRadius: 20,
    backgroundColor: palette.surface,
    padding: 18,
    gap: 14,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalHeadingCopy: { flex: 1 },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F0F4F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartUnit: { color: palette.muted, fontSize: 11, marginTop: 3 },
  rangeRow: { flexDirection: 'row', gap: 5 },
  rangeButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 7,
    backgroundColor: '#F0F4F5',
  },
  rangeButtonActive: { backgroundColor: palette.accent },
  rangeText: { color: palette.muted, fontSize: 11, fontWeight: '700' },
  rangeTextActive: { color: 'white' },
  barChart: {
    height: 190,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  barSlot: { flex: 1, minWidth: 2, height: 185, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '75%', minWidth: 2, maxWidth: 28, borderRadius: 4, backgroundColor: palette.brand },
  negativeBar: { backgroundColor: '#2878D0' },
  barValue: { color: palette.muted, fontSize: 7, marginBottom: 3, maxWidth: 48 },
  chartAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  axisText: { color: palette.muted, fontSize: 9 },
  chartFootnote: { color: palette.muted, fontSize: 10, textAlign: 'right' },
});
