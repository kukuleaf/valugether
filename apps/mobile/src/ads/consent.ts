type ConsentInfo = { canRequestAds: boolean; privacyOptionsRequirementStatus: string };
type ConsentPort = {
  gatherConsent: () => Promise<ConsentInfo>;
  getConsentInfo: () => Promise<ConsentInfo>;
};

// An offline consent update may use UMP's previous-session decision, never our own stored flag.
export async function prepareAds(
  consent: ConsentPort,
  initialize: () => Promise<unknown>,
  demoAdsOnly: boolean,
): Promise<ConsentInfo> {
  const info = demoAdsOnly
    ? { canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED' }
    : await consent.gatherConsent().catch(() => consent.getConsentInfo());
  if (info.canRequestAds) await initialize();
  return info;
}
