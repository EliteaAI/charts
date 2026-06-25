import { execSync } from 'node:child_process';

const chartsJson = process.argv[2];
const registry = process.argv[3]?.replace(/\/$/, '') || 'ghcr.io';

if (!chartsJson) {
  console.error('No charts_json provided to find-charts-to-release');
  process.exit(1);
}

const charts = JSON.parse(chartsJson);
const all = [];
const toRelease = [];

function compareVersions(local, remote) {
  if (!remote || remote === 'null') return true;
  if (local === remote) return false;

  const localParts = local.split('.').map(Number);
  const remoteParts = remote.split('.').map(Number);

  for (let i = 0; i < Math.max(localParts.length, remoteParts.length); i++) {
    const l = localParts[i] || 0;
    const r = remoteParts[i] || 0;
    if (l > r) return true;
    if (l < r) return false;
  }
  return false;
}

for (const chart of charts) {
  const { name, path, version: localVersion } = chart;
  let remoteVersion = null;

  try {
    const out = execSync(`helm show chart oci://${registry}/${name}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const match = out.match(/^version:\s*(.+)$/m);
    remoteVersion = match?.[1]?.trim() || null;
  } catch (err) {
    const stderr = err.stderr?.toString() || '';
    if (stderr.includes('manifest') || stderr.includes('not found') || stderr.includes('name unknown')) {
      console.error(`Chart ${name} not found in registry (new chart)`);
    } else {
      console.error(`Error retrieving remote chart for ${name}: ${stderr}`);
      process.exit(1);
    }
  }

  const shouldRelease = compareVersions(localVersion, remoteVersion);
  const entry = {
    name,
    path,
    local_version: localVersion,
    remote_version: remoteVersion,
  };

  all.push(entry);
  if (shouldRelease) toRelease.push(entry);
}

console.log(`to_release=${JSON.stringify(toRelease)}`);
console.log(`release_needed=${toRelease.length > 0}`);
console.error('All charts:', JSON.stringify(all, null, 2));
console.error('Charts to release:', JSON.stringify(toRelease, null, 2));
