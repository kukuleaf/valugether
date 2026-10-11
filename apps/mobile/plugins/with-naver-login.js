const { AndroidConfig, withStringsXml } = require('@expo/config-plugins');

const RESOURCE_NAMES = {
  clientId: 'valugether_naver_client_id',
  clientSecret: 'valugether_naver_client_secret',
  clientName: 'valugether_naver_client_name',
};

function credentials(env = process.env) {
  const clientId = env.NAVER_CLIENT_ID?.trim() ?? '';
  const clientSecret = env.NAVER_CLIENT_SECRET?.trim() ?? '';
  if (Boolean(clientId) !== Boolean(clientSecret)) {
    throw new Error('NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET을 함께 설정해 주세요.');
  }
  return { clientId, clientSecret };
}

function isNaverEnabled(env = process.env) {
  const { clientId, clientSecret } = credentials(env);
  return Boolean(clientId && clientSecret);
}

function androidString(value) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/^([@?])/, '\\$1');
}

function applyNaverStrings(strings, env = process.env) {
  const { clientId, clientSecret } = credentials(env);
  const values = { clientId, clientSecret, clientName: '가치보는주식' };
  return AndroidConfig.Strings.setStringItem(
    Object.entries(RESOURCE_NAMES).map(([key, name]) => ({
      $: { name, translatable: 'false' },
      _: androidString(values[key]),
    })),
    strings,
  );
}

function withNaverLogin(config) {
  return withStringsXml(config, (modConfig) => {
    modConfig.modResults = applyNaverStrings(modConfig.modResults);
    return modConfig;
  });
}

module.exports = withNaverLogin;
module.exports.isNaverEnabled = isNaverEnabled;
module.exports.applyNaverStrings = applyNaverStrings;
