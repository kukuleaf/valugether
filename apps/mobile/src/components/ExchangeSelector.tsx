import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Card, Muted, palette } from './ui';

export const exchangeOptions = [
  { code: 'KOSPI', label: '코스피' },
  { code: 'KOSDAQ', label: '코스닥' },
  { code: 'NASDAQ', label: '나스닥' },
  { code: 'NYSE', label: '뉴욕증권거래소' },
] as const;

export const defaultExchangeCodes = exchangeOptions.map((item) => item.code);

export function ExchangeSelector({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (code: string) => {
    if (selected.includes(code)) {
      if (selected.length > 1) onChange(selected.filter((item) => item !== code));
      return;
    }
    onChange([...selected, code]);
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>검색 시장</Text>
      <Muted>한 곳 이상 선택하세요.</Muted>
      <ScrollView
        horizontal
        testID="exchange-scroll"
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.row}
      >
        {exchangeOptions.map((exchange) => {
          const active = selected.includes(exchange.code);
          return (
            <Pressable
              key={exchange.code}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              onPress={() => toggle(exchange.code)}
              style={[styles.chip, active && styles.active]}
            >
              <Text style={[styles.label, active && styles.activeLabel]}>{exchange.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  title: { color: palette.text, fontSize: 16, fontWeight: '900' },
  scroll: { width: '100%', flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingRight: 2 },
  chip: {
    flexShrink: 0,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 999,
    backgroundColor: '#F5F7F8',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  active: { borderColor: palette.accent, backgroundColor: '#E1F2EE' },
  label: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  activeLabel: { color: palette.accent },
});
