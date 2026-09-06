import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, H1, Input, LoadingState, Muted, Page, palette } from '../../components/ui';
import { api } from '../../lib/api';
import { saveTokens } from '../../lib/session';

type Term = {
  term_id: number;
  term_code: string;
  title: string;
  version: string;
  content: string;
  is_required: boolean;
};

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState<Term[]>([]);
  const [agreements, setAgreements] = useState<Record<number, boolean>>({});
  const [selectedTerm, setSelectedTerm] = useState<Term | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Term[]>('/terms/active')
      .then(setTerms)
      .catch(() => Alert.alert('불러오기 실패', '약관을 불러오지 못했습니다. 다시 시도해 주세요.'))
      .finally(() => setLoading(false));
  }, []);

  const requiredAccepted = terms
    .filter((term) => term.is_required)
    .every((term) => agreements[term.term_id]);
  const allAccepted = terms.length > 0 && terms.every((term) => agreements[term.term_id]);

  const submit = async () => {
    if (!requiredAccepted) {
      Alert.alert('필수 동의 필요', '필수 약관을 확인하고 동의해 주세요.');
      return;
    }
    try {
      const tokens = await api<any>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          consents: terms.map((term) => ({
            termId: term.term_id,
            agreed: Boolean(agreements[term.term_id]),
          })),
        }),
      });
      await saveTokens(tokens);
      Alert.alert('가입 완료', '바른주식 밸류 가입이 완료되었습니다.');
    } catch (error: any) {
      Alert.alert('가입 실패', error.message);
    }
  };

  const toggleAll = () => {
    const next = !allAccepted;
    setAgreements(Object.fromEntries(terms.map((term) => [term.term_id, next])));
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      <Page>
        <H1>회원가입</H1>
        <Muted>서비스에 필요한 정보만 최소한으로 받습니다.</Muted>
        <Card>
          <Input placeholder="이메일" autoCapitalize="none" value={email} onChangeText={setEmail} />
          <Input
            placeholder="비밀번호 (10자 이상)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>약관 동의</Text>
          {loading ? (
            <LoadingState label="약관을 불러오고 있어요" />
          ) : (
            <>
              <AgreementRow label="모두 동의" checked={allAccepted} onPress={toggleAll} strong />
              <View style={styles.divider} />
              {terms.map((term) => (
                <AgreementRow
                  key={term.term_id}
                  label={`${term.is_required ? '[필수]' : '[선택]'} ${term.title}`}
                  version={term.version}
                  checked={Boolean(agreements[term.term_id])}
                  onPress={() =>
                    setAgreements((current) => ({
                      ...current,
                      [term.term_id]: !current[term.term_id],
                    }))
                  }
                  onView={() => setSelectedTerm(term)}
                />
              ))}
            </>
          )}
        </Card>

        <Button title="가입하기" onPress={submit} />
      </Page>

      <Modal
        visible={Boolean(selectedTerm)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTerm(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.termsSheet}>
            <Text style={styles.modalTitle}>{selectedTerm?.title}</Text>
            <Muted>버전 {selectedTerm?.version}</Muted>
            <ScrollView style={styles.termsContent}>
              <Text style={styles.termsText}>{selectedTerm?.content}</Text>
            </ScrollView>
            <Button title="확인" onPress={() => setSelectedTerm(null)} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function AgreementRow({
  label,
  version,
  checked,
  onPress,
  onView,
  strong,
}: {
  label: string;
  version?: string;
  checked: boolean;
  onPress: () => void;
  onView?: () => void;
  strong?: boolean;
}) {
  return (
    <View style={styles.agreementRow}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={onPress}
        style={styles.agreementMain}
      >
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          <Text style={styles.checkmark}>{checked ? '✓' : ''}</Text>
        </View>
        <Text style={[styles.agreementLabel, strong && styles.strong]}>{label}</Text>
      </Pressable>
      {onView && (
        <Pressable accessibilityRole="button" onPress={onView}>
          <Text style={styles.viewLink}>보기{version ? ` · v${version}` : ''}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: palette.bg },
  scrollContent: { paddingBottom: 30 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: palette.text },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 42,
    gap: 8,
  },
  agreementMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: palette.muted,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: palette.accent, borderColor: palette.accent },
  checkmark: { color: 'white', fontWeight: '900' },
  agreementLabel: { flex: 1, color: palette.text, fontSize: 14 },
  strong: { fontWeight: '800' },
  viewLink: { color: palette.accent, fontSize: 12, fontWeight: '700' },
  divider: { height: 1, backgroundColor: palette.line, marginVertical: 4 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  termsSheet: {
    width: '100%',
    maxWidth: 600,
    maxHeight: '80%',
    backgroundColor: palette.surface,
    borderRadius: 18,
    padding: 20,
    gap: 10,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: palette.text },
  termsContent: { marginVertical: 8 },
  termsText: { color: palette.text, fontSize: 15, lineHeight: 24 },
});
