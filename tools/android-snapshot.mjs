import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const name = process.argv[2] ?? 'screen';
if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Use a simple screenshot name.');
const sdk = process.env.ANDROID_HOME ?? 'C:/Users/dbsdu/AppData/Local/Android/Sdk';
const adb = path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const directory = path.resolve(import.meta.dirname, '../apps/mobile/dist/android-audit');
mkdirSync(directory, { recursive: true });
const run = (args) =>
  execFileSync(adb, args, { windowsHide: true, timeout: 30_000, maxBuffer: 16 * 1024 * 1024 });
writeFileSync(path.join(directory, `${name}.png`), run(['exec-out', 'screencap', '-p']));
run(['shell', 'uiautomator', 'dump', '/sdcard/valugether-audit.xml']);
const xml = run(['shell', 'cat', '/sdcard/valugether-audit.xml']).toString();
writeFileSync(path.join(directory, `${name}.xml`), xml);
console.log(path.join(directory, `${name}.png`));
console.log(
  [...xml.matchAll(/text="([^"]*)"[^>]*bounds="([^"]*)"/g)]
    .filter((item) => item[1])
    .map((item) => ({ text: item[1], bounds: item[2] })),
);
