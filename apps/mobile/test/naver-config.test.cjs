const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { getConfig } = require('@expo/config');
const { compileModsAsync } = require('@expo/config-plugins');
const {
  createAutolinkingOptionsLoader,
} = require('expo-modules-autolinking/build/commands/autolinkingOptions');
const { findModulesAsync } = require('expo-modules-autolinking/build/autolinking/findModules');
const {
  resolveModulesAsync,
} = require('expo-modules-autolinking/build/autolinking/resolveModules');
const { isNaverEnabled, applyNaverStrings } = require('../plugins/with-naver-login');
const configureApp = require('../app.config');
const moduleConfig = require('../modules/naver-login/expo-module.config.json');

const fakeCredentials = {
  NAVER_CLIENT_ID: 'test-client-id',
  NAVER_CLIENT_SECRET: 'test-client-secret',
};

async function withEnv(values, run) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function stringValues(strings) {
  return Object.fromEntries(strings.resources.string.map((entry) => [entry.$.name, entry._]));
}

test('Naver is enabled only with both native-build credentials; EXPO_PUBLIC values are ignored', () => {
  assert.equal(isNaverEnabled({}), false);
  assert.equal(isNaverEnabled({ NAVER_CLIENT_ID: ' ', NAVER_CLIENT_SECRET: ' ' }), false);
  assert.equal(isNaverEnabled(fakeCredentials), true);
  assert.equal(
    isNaverEnabled({
      EXPO_PUBLIC_NAVER_CLIENT_ID: 'public-id',
      EXPO_PUBLIC_NAVER_CLIENT_SECRET: 'public-secret',
    }),
    false,
  );
});

test('partially configured Naver credentials fail without exposing values', () => {
  for (const env of [
    { NAVER_CLIENT_ID: 'private-id' },
    { NAVER_CLIENT_SECRET: 'private-secret' },
  ]) {
    assert.throws(
      () => isNaverEnabled(env),
      (error) => {
        assert.match(error.message, /함께 설정/);
        assert.doesNotMatch(error.message, /private-id|private-secret/);
        return true;
      },
    );
  }
});

test('Naver credentials are added only to Android string resources, preserving existing resources', () => {
  const strings = applyNaverStrings(
    { resources: { string: [{ $: { name: 'app_name' }, _: 'Existing app' }] } },
    fakeCredentials,
  );
  assert.deepEqual(stringValues(strings), {
    app_name: 'Existing app',
    valugether_naver_client_id: 'test-client-id',
    valugether_naver_client_secret: 'test-client-secret',
    valugether_naver_client_name: '가치보는주식',
  });
  assert.ok(
    strings.resources.string
      .filter((entry) => entry.$.name.startsWith('valugether_naver_'))
      .every((entry) => entry.$.translatable === 'false'),
  );
});

test('Android string escaping handles resource references, quotes and backslashes', () => {
  const strings = applyNaverStrings(
    { resources: {} },
    {
      NAVER_CLIENT_ID: '@id-value',
      NAVER_CLIENT_SECRET: '?secret\\path\'"value',
    },
  );
  const values = stringValues(strings);
  assert.equal(values.valugether_naver_client_id, '\\@id-value');
  assert.equal(values.valugether_naver_client_secret, '\\?secret\\\\path\\\'\\"value');
});

test('regeneration updates existing resources once and clears credentials when unconfigured', () => {
  const initial = applyNaverStrings({ resources: {} }, fakeCredentials);
  const refreshed = applyNaverStrings(initial, {
    NAVER_CLIENT_ID: 'second-id',
    NAVER_CLIENT_SECRET: 'second-secret',
  });
  assert.equal(refreshed.resources.string.length, 3);
  assert.equal(stringValues(refreshed).valugether_naver_client_secret, 'second-secret');
  const disabled = applyNaverStrings(refreshed, {});
  assert.equal(stringValues(disabled).valugether_naver_client_id, '');
  assert.equal(stringValues(disabled).valugether_naver_client_secret, '');
});

test('public Expo config contains an enabled boolean, never Naver credentials or plugin options', async () => {
  await withEnv(
    { ...fakeCredentials, VALUGETHER_BUILD_ENV: 'development', VALUGETHER_ADS_ENABLED: 'false' },
    () => {
      const config = configureApp({
        config: { extra: { existing: true }, plugins: ['./plugins/with-naver-login'] },
      });
      assert.equal(config.extra.naverEnabled, true);
      assert.equal(config.extra.existing, true);
      assert.equal(
        config.plugins.filter((plugin) => plugin === './plugins/with-naver-login').length,
        1,
      );
      const serialized = JSON.stringify(config);
      assert.doesNotMatch(serialized, /test-client-id|test-client-secret|NAVER_CLIENT_SECRET/);
      const publicConfig = getConfig(path.resolve(__dirname, '..'), { isPublicConfig: true }).exp;
      assert.equal(publicConfig.extra.naverEnabled, true);
      assert.doesNotMatch(
        JSON.stringify(publicConfig),
        /test-client-id|test-client-secret|NAVER_CLIENT_SECRET/,
      );
    },
  );
});

test('Expo Android introspection injects stub credentials without writing native files', async () => {
  await withEnv(
    {
      ...fakeCredentials,
      EXPO_NO_DOTENV: '1',
      VALUGETHER_BUILD_ENV: 'development',
      VALUGETHER_ADS_ENABLED: 'false',
    },
    async () => {
      const projectRoot = path.resolve(__dirname, '..');
      const config = getConfig(projectRoot, { isModdedConfig: true }).exp;
      const compiled = await compileModsAsync(config, {
        projectRoot,
        platforms: ['android'],
        introspect: true,
        ignoreExistingNativeFiles: true,
      });
      const values = stringValues(compiled._internal.modResults.android.strings);
      assert.equal(values.valugether_naver_client_id, fakeCredentials.NAVER_CLIENT_ID);
      assert.equal(values.valugether_naver_client_secret, fakeCredentials.NAVER_CLIENT_SECRET);
      assert.equal(compiled.extra.naverEnabled, true);
      assert.doesNotMatch(JSON.stringify(compiled.extra), /test-client-id|test-client-secret/);
    },
  );
});

test('Naver local module is Android-only and exports the exact autolinking class', () => {
  assert.deepEqual(moduleConfig.platforms, ['android']);
  assert.deepEqual(moduleConfig.android.modules, [
    'expo.modules.naverlogin.ValugetherNaverLoginModule',
  ]);
});

test('Gradle autolinking from the native Android directory resolves local modules relative to the mobile app', async () => {
  const projectRoot = path.resolve(__dirname, '..');
  const loader = createAutolinkingOptionsLoader({ projectRoot: path.join(projectRoot, 'android') });
  const appRoot = await loader.getAppRoot();
  const autolinkingOptions = await loader.getPlatformOptions('android');
  assert.equal(appRoot, projectRoot);
  assert.equal(autolinkingOptions.nativeModulesDir, path.join(projectRoot, 'modules'));
  const modules = await resolveModulesAsync(
    await findModulesAsync({ appRoot, autolinkingOptions }),
    autolinkingOptions,
  );
  const naverModule = modules.find((module) => module.packageName === 'valugether-naver-login');
  assert.ok(naverModule);
  assert.equal(
    naverModule.projects[0].sourceDir,
    path.join(projectRoot, 'modules', 'naver-login', 'android'),
  );
  assert.ok(
    naverModule.projects[0].modules.some(
      (module) => module.classifier === 'expo.modules.naverlogin.ValugetherNaverLoginModule',
    ),
  );
});
