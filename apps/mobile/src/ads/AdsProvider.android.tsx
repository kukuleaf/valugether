import Constants from 'expo-constants';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { AdsConfig, AdsContext, AdsSdk } from './context';
import { prepareAds } from './consent';
export { AdsPrivacyButton } from './context';

const config = Constants.expoConfig?.extra?.ads as AdsConfig | undefined;
let initialization: Promise<void> | null = null;
function initializeOnce(sdk: AdsSdk) {
  if (!initialization)
    initialization = (async () => {
      await sdk
        .default()
        .setRequestConfiguration({ maxAdContentRating: sdk.MaxAdContentRating.PG });
      await sdk.default().initialize();
    })().catch((error) => {
      initialization = null;
      throw error;
    });
  return initialization;
}

export function AdsProvider({ children }: { children: ReactNode }) {
  const [sdk, setSdk] = useState<AdsSdk | null>(null);
  const [ready, setReady] = useState(false);
  const [privacyRequired, setPrivacyRequired] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!config?.enabled || Constants.executionEnvironment === 'storeClient') return;
    let active = true;
    void (async () => {
      const module = await import('react-native-google-mobile-ads');
      // Google's sample App ID cannot host UMP messages. Only demo ads bypass the live consent flow.
      const info = await prepareAds(
        module.AdsConsent,
        () => initializeOnce(module),
        config.mode === 'test',
      );
      if (!active) return;
      setSdk(module);
      setReady(info.canRequestAds);
      setPrivacyRequired(info.privacyOptionsRequirementStatus === 'REQUIRED');
    })().catch((error) => {
      if (__DEV__) console.warn('Ads unavailable; app continues without ads.', error);
    });
    return () => {
      active = false;
    };
  }, []);

  const openPrivacyOptions = useCallback(async () => {
    if (!sdk) return;
    // Remove loaded creatives while consent changes; a previous ad must not survive revocation.
    setReady(false);
    try {
      await sdk.AdsConsent.showPrivacyOptionsForm();
    } finally {
      const info = await sdk.AdsConsent.getConsentInfo();
      if (info.canRequestAds) await initializeOnce(sdk);
      setRevision((value) => value + 1);
      setPrivacyRequired(info.privacyOptionsRequirementStatus === 'REQUIRED');
      setReady(info.canRequestAds);
    }
  }, [sdk]);
  return (
    <AdsContext.Provider
      value={{ sdk, config: config ?? null, ready, privacyRequired, revision, openPrivacyOptions }}
    >
      {children}
    </AdsContext.Provider>
  );
}
