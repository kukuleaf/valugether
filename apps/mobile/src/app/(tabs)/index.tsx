import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ComponentProps, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Page, palette } from '../../components/ui';
import { defaultExchangeCodes, ExchangeSelector } from '../../components/ExchangeSelector';

type IconName = ComponentProps<typeof Ionicons>['name'];
const strategies: Array<{
  code: string;
  name: string;
  short: string;
  conditions: string;
  icon: IconName;
  background: string;
  iconColor: string;
}> = [
  {
    code: 'UNDERVALUED',
    name: '저평가 기업',
    short: '가치보다 가격이 낮은 회사',
    conditions: 'PER ≤ 15 · PBR ≤ 1.5 · ROE ≥ 8%',
    icon: 'pricetag-outline',
    background: '#E8F2FF',
    iconColor: '#246BCE',
  },
  {
    code: 'STABLE',
    name: '안정적인 기업',
    short: '재무가 튼튼한 회사',
    conditions: '부채 ≤ 100% · 유동 ≥ 1.2배 · FCF ≥ 0 · 3년 흑자',
    icon: 'shield-checkmark-outline',
    background: '#E4F7F1',
    iconColor: '#16876C',
  },
  {
    code: 'GROWTH',
    name: '성장하는 기업',
    short: '매출과 이익이 크는 회사',
    conditions: '매출 성장 ≥ 5% · EPS 성장 ≥ 5% · ROE ≥ 10%',
    icon: 'trending-up-outline',
    background: '#F0EBFF',
    iconColor: '#7251C7',
  },
  {
    code: 'DIVIDEND',
    name: '배당 기업',
    short: '배당을 꾸준히 주는 회사',
    conditions: '배당률 ≥ 2% · 3년 연속 · 배당성향 ≤ 70% · 흑자',
    icon: 'cash-outline',
    background: '#FFF2D8',
    iconColor: '#A76A00',
  },
];

export default function Home() {
  const [exchangeCodes, setExchangeCodes] = useState<string[]>(defaultExchangeCodes);
  const hero = useRef(new Animated.Value(Platform.OS === 'web' ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(hero, {
      toValue: 1,
      duration: 500,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [hero]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      <Page style={styles.page}>
        <Animated.View
          style={{
            opacity: hero,
            transform: [
              { translateY: hero.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
            ],
          }}
        >
          <LinearGradient colors={['#123E58', '#176B87', '#1A967D']} style={styles.hero}>
            <View style={styles.heroGlow} />
            <View style={styles.brandRow}>
              <View style={styles.brandIcon}>
                <Ionicons name="leaf" size={19} color="#123E58" />
              </View>
              <Text style={styles.brand}>바른주식 밸류</Text>
            </View>
            <Text style={styles.heroTitle}>숫자로 확인하는{String.fromCharCode(10)}좋은 기업</Text>
            <View style={styles.heroBadge}>
              <Ionicons name="compass-outline" size={24} color="#D9FFF4" />
              <Text style={styles.heroBadgeText}>내 기준에 맞는 기업 찾기&nbsp;</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        <ExchangeSelector selected={exchangeCodes} onChange={setExchangeCodes} />

        <View style={styles.grid}>
          {strategies.map((strategy, index) => (
            <StrategyCard
              key={strategy.code}
              strategy={strategy}
              delay={100 + index * 80}
              exchangeCodes={exchangeCodes}
            />
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="검색 조건 직접 설정"
          onPress={() => router.push('/advanced')}
          style={({ pressed }) => [styles.customCard, pressed && styles.pressed]}
        >
          <View style={styles.customIcon}>
            <Ionicons name="options-outline" size={23} color={palette.accent} />
          </View>
          <View style={styles.customText}>
            <Text style={styles.customTitle}>내 기준으로 직접 찾기</Text>
            <Text style={styles.customDescription}>수익성·성장성·부채 조건을 직접 정해보세요</Text>
          </View>
          <Ionicons name="chevron-forward" size={21} color={palette.muted} />
        </Pressable>

        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={18} color={palette.muted} />
          <Text style={styles.noticeText}>
            검색 결과는 참고정보입니다. 투자 전 최신 공시와 가격을 확인하세요.
          </Text>
        </View>
      </Page>
    </ScrollView>
  );
}

function StrategyCard({
  strategy,
  delay,
  exchangeCodes,
}: {
  strategy: (typeof strategies)[number];
  delay: number;
  exchangeCodes: string[];
}) {
  const entrance = useRef(new Animated.Value(Platform.OS === 'web' ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 420,
      delay,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [delay, entrance]);

  const setPressed = (pressed: boolean) =>
    Animated.spring(scale, {
      toValue: pressed ? 0.96 : 1,
      speed: 28,
      bounciness: 4,
      useNativeDriver: Platform.OS !== 'web',
    }).start();

  return (
    <Animated.View
      style={[
        styles.strategyWrap,
        {
          opacity: entrance,
          transform: [
            { scale },
            { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          ],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${strategy.name} 찾아보기`}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onPress={() =>
          router.push({
            pathname: '/results',
            params: { strategy: strategy.code, exchanges: JSON.stringify(exchangeCodes) },
          })
        }
        style={[styles.strategyCard, { backgroundColor: strategy.background }]}
      >
        <View style={[styles.strategyIcon, { backgroundColor: `${strategy.iconColor}18` }]}>
          <Ionicons name={strategy.icon} size={26} color={strategy.iconColor} />
        </View>
        <Text style={styles.strategyTitle}>{strategy.name}</Text>
        <Text style={styles.strategyDescription}>{strategy.short}</Text>
        <Text style={styles.strategyConditions}>{strategy.conditions}</Text>
        <View style={styles.exploreRow}>
          <Text style={[styles.exploreText, { color: strategy.iconColor }]}>살펴보기</Text>
          <Ionicons name="arrow-forward" size={15} color={strategy.iconColor} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: palette.bg },
  scrollContent: { paddingBottom: 30 },
  page: { paddingTop: 14 },
  hero: {
    minHeight: 235,
    overflow: 'hidden',
    borderRadius: 26,
    padding: 22,
    ...Platform.select({
      web: { boxShadow: '0 9px 24px rgba(18,62,88,0.22)' },
      default: {
        shadowColor: '#123E58',
        shadowOpacity: 0.22,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 9 },
        elevation: 5,
      },
    }),
  },
  heroGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -55,
    top: -70,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D9FFF4',
  },
  brand: { color: '#D9FFF4', fontWeight: '800', fontSize: 14, letterSpacing: 0.2 },
  heroTitle: {
    color: 'white',
    fontSize: 30,
    lineHeight: 39,
    fontWeight: '900',
    marginTop: 18,
    transform: [{ scaleX: 1.07 }],
    alignSelf: 'flex-start',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroBadgeText: { color: '#D9FFF4', fontSize: 12, fontWeight: '700' },
  grid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  strategyWrap: { width: '48%', flexGrow: 1 },
  strategyCard: {
    minHeight: 222,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  strategyIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },
  strategyTitle: { color: palette.text, fontSize: 16, fontWeight: '900' },
  strategyDescription: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  strategyConditions: { color: palette.text, fontSize: 11, lineHeight: 17, marginTop: 8 },
  exploreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 'auto',
    paddingTop: 12,
  },
  exploreText: { fontSize: 12, fontWeight: '800' },
  customCard: {
    width: '100%',
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 15,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: palette.line,
    ...Platform.select({
      web: { boxShadow: '0 5px 16px rgba(18,62,88,0.08)' },
      default: {
        shadowColor: '#123E58',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },
        elevation: 2,
      },
    }),
  },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  customIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F2F5',
  },
  customText: { flex: 1, minWidth: 0 },
  customTitle: { color: palette.text, fontSize: 16, fontWeight: '900' },
  customDescription: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingHorizontal: 5 },
  noticeText: { flex: 1, color: palette.muted, fontSize: 11, lineHeight: 17 },
});
