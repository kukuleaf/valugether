import { createContext, useContext, useState } from 'react';
import { Alert } from 'react-native';
import { Button } from '../components/ui';

export type AdsConfig = {
  enabled: boolean;
  mode: 'test' | 'production';
  homeUnitId: string;
  resultsUnitId: string;
};
export type AdsSdk = typeof import('react-native-google-mobile-ads');
export const AdsContext = createContext<{
  sdk: AdsSdk | null;
  config: AdsConfig | null;
  ready: boolean;
  privacyRequired: boolean;
  revision: number;
  openPrivacyOptions: () => Promise<void>;
}>({
  sdk: null,
  config: null,
  ready: false,
  privacyRequired: false,
  revision: 0,
  openPrivacyOptions: async () => {},
});

export const useAds = () => useContext(AdsContext);

export function AdsPrivacyButton() {
  const { privacyRequired, openPrivacyOptions } = useAds();
  const [busy, setBusy] = useState(false);
  if (!privacyRequired) return null;
  return (
    <Button
      title="광고 개인정보 선택"
      secondary
      disabled={busy}
      onPress={() => {
        if (busy) return;
        setBusy(true);
        void openPrivacyOptions()
          .catch(() =>
            Alert.alert(
              '광고 개인정보 선택',
              '설정을 열지 못했습니다. 잠시 후 다시 시도해 주세요.',
            ),
          )
          .finally(() => setBusy(false));
      }}
    />
  );
}
