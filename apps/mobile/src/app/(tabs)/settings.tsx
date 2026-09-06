import { router } from 'expo-router';
import { Button, Card, H1, Muted, Page } from '../../components/ui';
export default function Settings() {
  return (
    <Page>
      <H1>내 설정</H1>
      <Card>
        <Muted>회원정보는 이메일과 인증정보 위주로 최소 수집합니다.</Muted>
        <Button title="로그인" onPress={() => router.push('/auth/login')} />
        <Button title="회원가입" secondary onPress={() => router.push('/auth/register')} />
      </Card>
      <Card>
        <Muted>광고 없이 이용하기와 추가 분석 기능은 추후 제공할 예정입니다.</Muted>
      </Card>
    </Page>
  );
}
