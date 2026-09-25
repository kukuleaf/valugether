import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const suffix = `${Date.now()}-${process.pid}`;
const containerName = `stock-redis-e2e-${suffix}`;
const queueName = `right-stock-batch-e2e-${suffix}`;

function docker(args, options = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    windowsHide: true,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `docker ${args[0]} failed`).trim());
  }
  return result.stdout.trim();
}

let started = false;
try {
  docker([
    'run',
    '--detach',
    '--name',
    containerName,
    '--publish',
    '127.0.0.1::6379',
    'redis:7-alpine',
  ]);
  started = true;
  const portOutput = docker(['port', containerName, '6379/tcp']);
  const port = portOutput.match(/:(\d+)$/)?.[1];
  if (!port) throw new Error(`Could not parse Redis port: ${portOutput}`);

  const result = spawnSync(
    process.execPath,
    [
      '--env-file=apps/api/.env',
      '--test',
      '--test-concurrency=1',
      'apps/api/test/batch-queue.e2e.mjs',
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        BATCH_WORKER_ENABLED: 'true',
        BATCH_QUEUE_NAME: queueName,
        BATCH_REDIS_STARTUP_TIMEOUT_MS: '10000',
        REDIS_URL: `redis://127.0.0.1:${port}`,
        RATE_LIMIT_STORE: 'memory',
        OPS_ALERT_EMAIL_ENABLED: 'false',
      },
      stdio: 'inherit',
      windowsHide: true,
    },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  if (started) {
    spawnSync('docker', ['rm', '--force', containerName], {
      stdio: 'ignore',
      windowsHide: true,
    });
  }
}
