const { existsSync, readdirSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const cache = path.join(process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local'), 'electron-builder', 'Cache');
const options = [process.env.MAKENSIS_PATH, 'C:\\Program Files (x86)\\NSIS\\makensis.exe', 'C:\\Program Files\\NSIS\\makensis.exe'].filter(Boolean);
if (existsSync(cache)) {
  for (const version of readdirSync(cache).filter((entry) => entry.startsWith('nsis-'))) {
    const dir = path.join(cache, version);
    for (const unpacked of readdirSync(dir).filter((entry) => entry.startsWith('nsis-'))) {
      options.push(path.join(dir, unpacked, 'Bin', 'makensis.exe'));
    }
  }
}
const compiler = options.find((candidate) => existsSync(candidate));
if (!compiler) throw new Error('NSIS makensis.exe가 없습니다. NSIS 3을 설치하거나 MAKENSIS_PATH 환경변수에 경로를 지정해 주세요.');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' } });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

if (!process.argv.includes('--skip-package')) {
  run(process.execPath, [path.join(root, 'node_modules', 'electron-builder', 'cli.js'), '--win', 'dir', '--x64']);
}
run(compiler, ['-INPUTCHARSET', 'UTF8', path.join('build', 'installer.nsi')]);
console.log('설치 파일: dist/claim-period-reference-setup-0.2.0.exe (코드 서명 없음)');
