import { spawn, spawnSync } from 'node:child_process';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
loadEnv({ path: path.join(root, 'apps/api/.env') });

const apiEnvironment = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: '3201',
  BATCH_WORKER_ENABLED: 'false',
  CORS_ALLOWED_ORIGINS: 'http://127.0.0.1:3101,http://127.0.0.1:3102',
  RATE_LIMIT_STORE: 'memory',
  AUTH_RATE_LIMIT_MAX: '100',
  SEARCH_RATE_LIMIT_MAX: '100',
};
const servers = [
  start(['apps/api/dist/src/main.js'], apiEnvironment),
  start(['node_modules/next/dist/bin/next', 'start', 'apps/admin', '-p', '3101'], {
    ...process.env,
    NODE_ENV: 'production',
    ADMIN_API_BASE_URL: 'http://127.0.0.1:3201/api',
  }),
  start(['tools/static-server.mjs', 'apps/mobile/dist/e2e-web', '3102'], process.env),
];

let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    if (stopping) return;
    stopping = true;
    stopServers();
    process.exit(130);
  });
}

let exitCode = 1;
try {
  await Promise.all([
    waitFor('http://127.0.0.1:3201/api/health', 60_000),
    waitFor('http://127.0.0.1:3101/login', 60_000),
    waitFor('http://127.0.0.1:3102', 30_000),
  ]);
  exitCode = await runPlaywright();
} finally {
  stopping = true;
  stopServers();
}
process.exit(exitCode);

function start(args, environment) {
  return spawn(process.execPath, args, {
    cwd: root,
    env: environment,
    stdio: 'inherit',
    windowsHide: true,
  });
}

function runPlaywright() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)],
      { cwd: root, env: process.env, stdio: 'inherit', windowsHide: true },
    );
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

async function waitFor(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status < 500) return;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

function stopServers() {
  for (const child of servers) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } else {
      child.kill('SIGTERM');
    }
  }
}
