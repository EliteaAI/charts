import { execSync } from 'node:child_process';

const chartsJson = process.argv[2];
const failFast = process.argv[3] !== 'false';

if (!chartsJson) {
  console.error('No charts_json provided to lint-charts action');
  console.log('success=false');
  process.exit(1);
}

const charts = JSON.parse(chartsJson);
const report = [];
let success = true;

for (const chart of charts) {
  const { name, path } = chart;
  console.error(`Linting ${name} (${path})`);

  try {
    execSync(`helm dependency update || helm dependency build`, {
      cwd: path,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
  } catch {
    console.error(`Dependencies update/build failed for ${name}`);
  }

  try {
    execSync('helm lint .', { cwd: path, stdio: 'inherit' });
    report.push({ name, path, result: 'ok' });
  } catch {
    success = false;
    report.push({ name, path, result: 'lint_failed' });
    if (failFast) {
      console.error(`Lint failed for ${name}`);
      console.log('success=false');
      console.log(`report=${JSON.stringify(report)}`);
      process.exit(1);
    }
  }
}

console.log(`success=${success}`);
console.log(`report=${JSON.stringify(report)}`);
console.error('Lint report:', JSON.stringify(report, null, 2));
