import { execSync } from 'node:child_process';
import { readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const toRelease = JSON.parse(process.env.TO_RELEASE || '[]');
const registry = (process.env.REGISTRY || 'ghcr.io').replace(/\/$/, '');
const pkgDir = '/tmp/release-packages';
const report = [];

mkdirSync(pkgDir, { recursive: true });

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', ...opts });
  } catch (err) {
    console.error(`Command failed: ${cmd}`);
    console.error(err.stderr?.toString() || err.message);
    return null;
  }
}

for (const chart of toRelease) {
  const { name, path, local_version: version } = chart;
  console.error(`\nPreparing ${name} version ${version} from ${path}`);

  run('helm dependency update || helm dependency build', { cwd: path, shell: true });

  const packResult = run(`helm package "${path}" --destination "${pkgDir}"`, { shell: true });
  if (!packResult) {
    report.push({ name, version, pushed: false, errors: ['packaging_failed'] });
    continue;
  }

  const packages = readdirSync(pkgDir).filter((f) => f.endsWith('.tgz'));
  const pkg = packages.find((p) => p.startsWith(name)) || packages[0];
  if (!pkg) {
    report.push({ name, version, pushed: false, errors: ['packaging_failed'] });
    continue;
  }

  const pkgPath = join(pkgDir, pkg);
  const imageRef = `${registry}/${name}:${version}`;
  const errors = [];

  console.error(`Pushing ${pkgPath} to ${imageRef}`);
  if (!run(`helm push "${pkgPath}" oci://${registry}`, { shell: true })) {
    errors.push('push_failed');
  }

  console.error(`Signing OCI artifact: ${imageRef}`);
  if (
    !run(`COSIGN_EXPERIMENTAL=true cosign sign --yes "${imageRef}"`, {
      shell: true,
      env: { ...process.env, COSIGN_EXPERIMENTAL: 'true' },
    })
  ) {
    errors.push('cosign_failed');
  }

  const ahFile = join(path, 'artifacthub-repo.yml');
  if (existsSync(ahFile)) {
    console.error(`Publishing ArtifactHub metadata for ${name}`);
    if (
      !run(
        `oras push "${registry}/${name}:artifacthub.io" --config /dev/null:application/vnd.cncf.artifacthub.config.v1+yaml "${ahFile}":application/vnd.cncf.artifacthub.repository-metadata.layer.v1.yaml`,
        { shell: true }
      )
    ) {
      errors.push('artifacthub_failed');
    }
  }

  report.push({ name, version, pushed: errors.length === 0, errors });
}

console.log(`report=${JSON.stringify(report)}`);
console.error('\nRelease report:', JSON.stringify(report, null, 2));
