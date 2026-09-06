import { Text } from 'react-native';
import { Card, H1, Muted, Page, palette } from '../../components/ui';
export default function Watchlist() {
  return (
    <Page>
      <H1>관심종목</H1>
      <Muted>로그인하면 관심 있는 회사를 안전하게 보관할 수 있습니다.</Muted>
      <Card>
        <Text style={{ color: palette.text, fontWeight: '700' }}>아직 관심종목이 없습니다.</Text>
        <Muted>검색결과나 종목 상세에서 관심종목에 추가할 수 있습니다.</Muted>
      </Card>
    </Page>
  );
}
