import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { Button, Card, H1, LoadingState, Muted, Page, palette } from '../components/ui';
import { api } from '../lib/api';
import { AdsPrivacyButton } from '../ads/AdsProvider';

type PrivacyTerm = {
  term_code: string;
  title: string;
  version: string;
  content: string;
  effective_from: string;
};

export default function PrivacyScreen() {
  const [term, setTerm] = useState<PrivacyTerm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const adsEnabled = Platform.OS === 'android' && Constants.expoConfig?.extra?.ads?.enabled;
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void api<PrivacyTerm[]>('/terms/active')
      .then((terms) => {
        if (!active) return;
        const privacy = terms.find((item) => item.term_code === 'PRIVACY');
        if (!privacy) throw new Error('게시된 개인정보 처리방침이 없습니다.');
        setTerm(privacy);
      })
      .catch(() => {
        if (active) setError('개인정보 처리방침을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Page>
        <H1>개인정보 처리방침</H1>
        {adsEnabled && (
          <Card>
            <Text style={styles.title}>Google 광고 안내</Text>
            <Muted>
              앱은 Google AdMob 배너를 사용합니다. 광고 SDK는 IP 주소, 광고 관련 식별자, 광고
              이용·진단 정보를 처리할 수 있습니다. 이메일·검색 조건·관심기업 목록은 광고 요청에
              전달하지 않습니다.
            </Muted>
            <Muted>
              비개인화 광고를 요청하며, 필요한 지역에서는 Google 동의 화면으로 선택을 확인합니다.
              비개인화 광고도 일부 기기 정보를 처리할 수 있습니다.
            </Muted>
            <AdsPrivacyButton />
            <Button
              title="Google 광고 개인정보 안내"
              secondary
              onPress={() => {
                void Linking.openURL('https://policies.google.com/technologies/ads').catch(() =>
                  setError('링크를 열지 못했습니다. 잠시 후 다시 시도해 주세요.'),
                );
              }}
            />
          </Card>
        )}
        {loading ? (
          <LoadingState />
        ) : error ? (
          <Card>
            <Muted>{error}</Muted>
            <Button
              title="다시 불러오기"
              secondary
              onPress={() => setRetry((value) => value + 1)}
            />
          </Card>
        ) : (
          term && (
            <Card>
              <Text style={styles.title}>{term.title}</Text>
              <Muted>
                버전 {term.version} · 시행일 {term.effective_from.slice(0, 10)}
              </Muted>
              <Text style={styles.body}>{term.content}</Text>
            </Card>
          )
        )}
      </Page>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { paddingBottom: 24 },
  title: { color: palette.text, fontSize: 16, fontWeight: '800' },
  body: { color: palette.text, fontSize: 14, lineHeight: 23, marginTop: 8 },
});
