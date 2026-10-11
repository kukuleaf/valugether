import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { prepareAds } from '../src/ads/consent.ts';
const require = createRequire(import.meta.url);
const { resolveAdsConfig, TEST_ANDROID_APP_ID, TEST_BANNER_UNIT_ID } = require('../ads.config.js');
const production = {
  VALUGETHER_BUILD_ENV: 'production',
  EXPO_PUBLIC_ADS_ENABLED: 'true',
  EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: 'ca-app-pub-1234567890123456~1234567890',
  EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID: 'ca-app-pub-1234567890123456/1234567890',
};

test('EAS development and preview profiles cannot use production advertising IDs', () => {
  const { build } = require('../eas.json');
  for (const name of ['development', 'preview']) {
    const config = resolveAdsConfig({ ...build.production.env, ...build[name].env });
    assert.equal(config.enabled, true);
    assert.equal(config.mode, 'test');
    assert.equal(config.androidAppId, TEST_ANDROID_APP_ID);
    assert.equal(config.homeUnitId, TEST_BANNER_UNIT_ID);
    assert.equal(config.resultsUnitId, TEST_BANNER_UNIT_ID);
  }
});

test('EAS production injects the supplied App ID and separate banner units into native config', () => {
  const { build } = require('../eas.json');
  const before = { ...process.env };
  try {
    Object.assign(process.env, build.production.env);
    const result = require('../app.config.js')({ config: { plugins: [] } });
    const config = result.extra.ads;
    assert.equal(config.enabled, true);
    assert.equal(config.mode, 'production');
    assert.equal(config.androidAppId, 'ca-app-pub-5560163853842844~6891356682');
    assert.equal(config.homeUnitId, 'ca-app-pub-5560163853842844/2984910423');
    assert.equal(config.resultsUnitId, 'ca-app-pub-5560163853842844/2952111675');
    const plugin = result.plugins.find((entry) => entry[0] === 'react-native-google-mobile-ads');
    assert.equal(plugin[1].androidAppId, config.androidAppId);
    assert.equal(plugin[1].delayAppMeasurementInit, true);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
});

test('Expo prebuild introspection creates production/test Android metadata from EAS without writing files', async () => {
  const { getConfig } = require('@expo/config');
  const { compileModsAsync } = require('@expo/config-plugins');
  const { build } = require('../eas.json');
  const before = { ...process.env };
  const projectRoot = fileURLToPath(new URL('..', import.meta.url));
  try {
    process.env.EXPO_NO_DOTENV = '1';
    delete process.env.NAVER_CLIENT_ID;
    delete process.env.NAVER_CLIENT_SECRET;
    for (const name of ['development', 'preview', 'production']) {
      Object.assign(process.env, build.production.env, build[name].env);
      const config = getConfig(projectRoot, { isModdedConfig: true }).exp;
      const compiled = await compileModsAsync(config, {
        projectRoot,
        platforms: ['android'],
        introspect: true,
        ignoreExistingNativeFiles: true,
      });
      const manifest = compiled._internal.modResults.android.manifest.manifest;
      const metadata = manifest.application[0]['meta-data'];
      const appId = metadata.find(
        (item) => item.$['android:name'] === 'com.google.android.gms.ads.APPLICATION_ID',
      );
      assert.equal(
        appId.$['android:value'],
        name === 'production'
          ? build.production.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID
          : TEST_ANDROID_APP_ID,
      );
      const delay = metadata.find(
        (item) =>
          item.$['android:name'] === 'com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT',
      );
      assert.equal(delay.$['android:value'], 'true');
      assert.equal(
        manifest.application[0].$['android:usesCleartextTraffic'],
        String(name !== 'production'),
      );
    }
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
});

test('disabled production does not require ad credentials', () => {
  assert.equal(
    resolveAdsConfig({ VALUGETHER_BUILD_ENV: 'production', EXPO_PUBLIC_ADS_ENABLED: 'false' })
      .enabled,
    false,
  );
});
test('preview ignores live IDs and always uses Google demo ads', () => {
  const config = resolveAdsConfig({ ...production, VALUGETHER_BUILD_ENV: 'preview' });
  assert.equal(config.mode, 'test');
  assert.equal(config.androidAppId, TEST_ANDROID_APP_ID);
  assert.equal(config.homeUnitId, TEST_BANNER_UNIT_ID);
  assert.equal(config.resultsUnitId, TEST_BANNER_UNIT_ID);
});
test('production accepts real IDs and separate placement units', () => {
  const config = resolveAdsConfig({
    ...production,
    EXPO_PUBLIC_ADMOB_RESULTS_BANNER_UNIT_ID: 'ca-app-pub-1234567890123456/2345678901',
  });
  assert.equal(config.mode, 'production');
  assert.equal(config.homeUnitId, production.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID);
  assert.equal(config.resultsUnitId, 'ca-app-pub-1234567890123456/2345678901');
});
test('production rejects demo App IDs', () => {
  assert.throws(() =>
    resolveAdsConfig({ ...production, EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: TEST_ANDROID_APP_ID }),
  );
});
test('production rejects demo, missing and foreign publisher units', () => {
  for (const unit of ['', TEST_BANNER_UNIT_ID, 'ca-app-pub-9999999999999999/1234567890']) {
    assert.throws(() =>
      resolveAdsConfig({ ...production, EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID: unit }),
    );
  }
});
test('plugin delays measurement and avoids duplicate plugin entries', () => {
  const before = { ...process.env };
  try {
    process.env.EXPO_PUBLIC_ADS_ENABLED = 'false';
    const result = require('../app.config.js')({
      config: {
        extra: { other: 1 },
        plugins: [
          ['react-native-google-mobile-ads', {}],
          ['expo-build-properties', {}],
        ],
      },
    });
    const ads = result.plugins.filter((plugin) => plugin[0] === 'react-native-google-mobile-ads');
    assert.equal(ads.length, 1);
    assert.equal(ads[0][1].delayAppMeasurementInit, true);
    assert.equal(result.extra.other, 1);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
});

function port(canRequestAds, events, error = false) {
  return {
    async gatherConsent() {
      events.push('consent');
      if (error) throw new Error('offline');
      return { canRequestAds, privacyOptionsRequirementStatus: 'REQUIRED' };
    },
    async getConsentInfo() {
      events.push('cached-ump');
      return { canRequestAds, privacyOptionsRequirementStatus: 'REQUIRED' };
    },
  };
}
test('live SDK starts only after consent permits ad requests', async () => {
  const events = [];
  const info = await prepareAds(port(true, events), async () => events.push('initialize'), false);
  assert.deepEqual(events, ['consent', 'initialize']);
  assert.equal(info.canRequestAds, true);
});
test('consent-required/denied gate never initializes live SDK', async () => {
  const events = [];
  const info = await prepareAds(port(false, events), async () => events.push('initialize'), false);
  assert.deepEqual(events, ['consent']);
  assert.equal(info.canRequestAds, false);
});
test('offline without previous permission stays ad-free', async () => {
  const events = [];
  await prepareAds(port(false, events, true), async () => events.push('initialize'), false);
  assert.deepEqual(events, ['consent', 'cached-ump']);
});
test('offline uses only the previous UMP decision', async () => {
  const events = [];
  await prepareAds(port(true, events, true), async () => events.push('initialize'), false);
  assert.deepEqual(events, ['consent', 'cached-ump', 'initialize']);
});
test('unknown consent or initialization errors propagate to the optional-ad fallback', async () => {
  await assert.rejects(
    prepareAds(
      {
        gatherConsent: async () => {
          throw new Error('offline');
        },
        getConsentInfo: async () => {
          throw new Error('unknown');
        },
      },
      async () => assert.fail(),
      false,
    ),
  );
  await assert.rejects(
    prepareAds(
      port(true, []),
      async () => {
        throw new Error('SDK failed');
      },
      false,
    ),
  );
});
test('Google demo App ID does not need live UMP server configuration', async () => {
  const events = [];
  await prepareAds(port(false, events), async () => events.push('initialize'), true);
  assert.deepEqual(events, ['initialize']);
});
