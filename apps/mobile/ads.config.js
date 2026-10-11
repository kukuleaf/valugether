const TEST_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const TEST_IOS_APP_ID = 'ca-app-pub-3940256099942544~1458002511';
const TEST_BANNER_UNIT_ID = 'ca-app-pub-3940256099942544/9214589741';

function resolveAdsConfig(env = process.env) {
  const enabled = env.EXPO_PUBLIC_ADS_ENABLED === 'true';
  const production = env.VALUGETHER_BUILD_ENV === 'production';
  const value = (name) => env[name]?.trim() ?? '';
  const androidAppId = value('EXPO_PUBLIC_ADMOB_ANDROID_APP_ID');
  const fallbackUnit = value('EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID');
  const homeUnitId = value('EXPO_PUBLIC_ADMOB_HOME_BANNER_UNIT_ID') || fallbackUnit;
  const resultsUnitId = value('EXPO_PUBLIC_ADMOB_RESULTS_BANNER_UNIT_ID') || fallbackUnit;

  if (enabled && production) {
    const realId = (id, pattern) => pattern.test(id) && !id.includes('3940256099942544');
    if (!realId(androidAppId, /^ca-app-pub-\d{16}~\d{10}$/)) {
      throw new Error('Production ads require a real EXPO_PUBLIC_ADMOB_ANDROID_APP_ID.');
    }
    for (const [placement, id] of [
      ['home', homeUnitId],
      ['results', resultsUnitId],
    ]) {
      if (
        !realId(id, /^ca-app-pub-\d{16}\/\d{10}$/) ||
        id.split('/')[0] !== androidAppId.split('~')[0]
      ) {
        throw new Error(
          `Production ads require a real ${placement} banner unit from the same AdMob account.`,
        );
      }
    }
  }

  // Preview APKs must never generate live impressions, even with production IDs in .env.
  return {
    enabled,
    mode: production ? 'production' : 'test',
    androidAppId: enabled && production ? androidAppId : TEST_ANDROID_APP_ID,
    iosAppId: TEST_IOS_APP_ID,
    homeUnitId: enabled && production ? homeUnitId : TEST_BANNER_UNIT_ID,
    resultsUnitId: enabled && production ? resultsUnitId : TEST_BANNER_UNIT_ID,
  };
}

module.exports = { resolveAdsConfig, TEST_ANDROID_APP_ID, TEST_BANNER_UNIT_ID };
