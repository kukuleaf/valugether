module.exports = ({ config }) => {
  const allowCleartext = process.env.VALUGETHER_BUILD_ENV !== 'production';
  const kakaoAppKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY?.trim();
  const plugins = (config.plugins ?? []).filter(
    (plugin) => plugin !== 'expo-build-properties' && plugin !== '@react-native-seoul/kakao-login',
  );

  return {
    ...config,
    plugins: [
      ...plugins,
      ...(kakaoAppKey ? [['@react-native-seoul/kakao-login', { kakaoAppKey }]] : []),
      [
        'expo-build-properties',
        {
          android: {
            usesCleartextTraffic: allowCleartext,
            extraMavenRepos: ['https://devrepo.kakao.com/nexus/content/groups/public/'],
          },
        },
      ],
    ],
  };
};
