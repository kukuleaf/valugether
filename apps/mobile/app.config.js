const { resolveAdsConfig } = require('./ads.config');
const { isNaverEnabled } = require('./plugins/with-naver-login');

module.exports = ({ config }) => {
  const ads = resolveAdsConfig();
  const allowCleartext = process.env.VALUGETHER_BUILD_ENV !== 'production';
  const kakaoAppKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY?.trim();
  const naverEnabled = isNaverEnabled();
  const plugins = (config.plugins ?? []).filter(
    (plugin) =>
      ![
        'expo-build-properties',
        '@react-native-seoul/kakao-login',
        'react-native-google-mobile-ads',
        './plugins/with-naver-login',
      ].includes(Array.isArray(plugin) ? plugin[0] : plugin),
  );

  return {
    ...config,
    extra: { ...config.extra, ads, naverEnabled },
    plugins: [
      ...plugins,
      './plugins/with-naver-login',
      ...(kakaoAppKey ? [['@react-native-seoul/kakao-login', { kakaoAppKey }]] : []),
      [
        'react-native-google-mobile-ads',
        {
          androidSdk: 'classic',
          androidAppId: ads.androidAppId,
          iosAppId: ads.iosAppId,
          delayAppMeasurementInit: true,
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            usesCleartextTraffic: allowCleartext,
            extraProguardRules: '-keep class com.google.android.gms.internal.consent_sdk.** { *; }',
            extraMavenRepos: ['https://devrepo.kakao.com/nexus/content/groups/public/'],
          },
        },
      ],
    ],
  };
};
