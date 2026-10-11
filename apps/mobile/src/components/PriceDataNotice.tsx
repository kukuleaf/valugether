import { StyleSheet, Text, View } from 'react-native';
import { palette } from './ui';

export type PriceStatus = 'CURRENT' | 'DELAYED' | 'MISSING';

export function PriceDataNotice({
  status,
  asOfDate,
}: {
  status: PriceStatus;
  asOfDate: string | null;
}) {
  const date = asOfDate?.slice(0, 10);
  const message =
    status === 'MISSING'
      ? '시세 없음 · 가격 기반 지표를 확인해 주세요.'
      : status === 'DELAYED'
        ? `시세 지연 · 마지막 저장 ${date ?? '기준일 없음'}. 최신 시세가 아닐 수 있습니다.`
        : `시세 기준일 ${date ?? '정보 없음'}`;

  return (
    <View style={[styles.box, status !== 'CURRENT' && styles.warning]}>
      <Text style={[styles.text, status !== 'CURRENT' && styles.warningText]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignSelf: 'stretch', paddingVertical: 6 },
  warning: {
    borderRadius: 10,
    backgroundColor: '#FFF3D9',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  text: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  warningText: { color: '#755100', fontWeight: '700' },
});
