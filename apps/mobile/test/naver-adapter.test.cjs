const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');

const source = readFileSync(path.join(__dirname, '../src/lib/naver.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function adapter({
  platform = 'android',
  environment = 'standalone',
  enabled = true,
  native,
} = {}) {
  let imports = 0;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      if (name === 'react-native') return { Platform: { OS: platform } };
      if (name === 'expo-constants')
        return {
          __esModule: true,
          default: {
            executionEnvironment: environment,
            expoConfig: { extra: { naverEnabled: enabled } },
          },
        };
      if (name === 'expo') {
        imports += 1;
        return {
          requireNativeModule(moduleName) {
            assert.equal(moduleName, 'ValugetherNaverLogin');
            if (!native) throw new Error('native module missing');
            return native;
          },
        };
      }
      throw new Error('Unexpected module import');
    },
  });
  return { ...exports, imports: () => imports };
}

test('unsupported platforms, Expo Go, and unconfigured apps cannot initialize NAVER', async () => {
  for (const configuration of [
    { platform: 'web' },
    { platform: 'ios' },
    { environment: 'storeClient' },
    { enabled: false },
  ]) {
    const sdk = adapter(configuration);
    assert.equal(sdk.isNaverLoginAvailable(), false);
    await assert.rejects(sdk.naverLogin(), /Android|준비|설치/);
    assert.equal(sdk.imports(), 0);
  }
});

test('an older APK without the native module fails with an actionable message', async () => {
  await assert.rejects(adapter().naverLogin(), /최신 Android 앱/);
});

test('login and account deletion pass the explicit reauthentication flag without storing provider tokens', async () => {
  const calls = [];
  const sdk = adapter({
    native: {
      async login(reauthenticate) {
        calls.push(reauthenticate);
        return { accessToken: 'provider-token', refreshToken: 'provider-refresh' };
      },
      async logout() {
        calls.push('logout');
      },
    },
  });
  assert.equal((await sdk.naverLogin()).accessToken, 'provider-token');
  assert.equal((await sdk.naverLogin(true)).refreshToken, 'provider-refresh');
  await sdk.naverLogout();
  assert.deepEqual(calls, [false, true, 'logout']);
});

test('an empty token cannot reach the API', async () => {
  for (const proof of [
    { accessToken: ' ', refreshToken: 'refresh' },
    { accessToken: 'access', refreshToken: ' ' },
  ]) {
    await assert.rejects(
      adapter({
        native: {
          async login() {
            return proof;
          },
        },
      }).naverLogin(),
      /로그인 정보를 받지 못했습니다/,
    );
  }
});

test('cancellation is readable and SDK exceptions cannot expose their sensitive payload', async () => {
  for (const [code, expected] of [
    ['E_NAVER_CANCELLED', /취소/],
    ['E_NAVER_LOGIN', /로그인에 실패/],
  ]) {
    const sdk = adapter({
      native: {
        async login() {
          throw Object.assign(new Error('secret-provider-error-payload'), { code });
        },
      },
    });
    await assert.rejects(
      sdk.naverLogin(),
      (error) =>
        expected.test(error.message) && !error.message.includes('secret-provider-error-payload'),
    );
  }
});
