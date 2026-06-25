import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const chartsJson = process.argv[2];

if (!chartsJson) {
  console.error('No charts_json provided');
  console.log('success=false');
  process.exit(1);
}

const charts = JSON.parse(chartsJson);
let success = true;

function run(cmd, opts = {}) {
  try {
    execSync(cmd, { encoding: 'utf8', stdio: 'pipe', ...opts });
    return true;
  } catch {
    return false;
  }
}

for (const chart of charts) {
  const { name, path } = chart;
  console.error(`::group::Validating ${name}`);

  run('helm dependency update || helm dependency build', { cwd: path, shell: true });

  const schemaPath = join(path, 'values.schema.json');
  if (!existsSync(schemaPath)) {
    console.error(`⚠️  No values.schema.json found for ${name} - skipping`);
    console.error('::endgroup::');
    continue;
  }

  console.error(`Found values.schema.json for ${name}`);

  const valuesPath = join(path, 'values.yaml');
  console.error(`Validating ${valuesPath}`);
  if (!run(`helm template "${path}" --values "${valuesPath}"`, { shell: true })) {
    console.error(`❌ Base values.yaml validation failed for ${name}`);
    success = false;
  } else {
    console.error('✅ Base values.yaml is valid');
  }

  const valuesDir = join(path, 'values');
  if (existsSync(valuesDir)) {
    for (const file of readdirSync(valuesDir)) {
      if (!file.endsWith('.yaml')) continue;
      const filePath = join(valuesDir, file);
      console.error(`Validating ${filePath}`);
      if (!run(`helm template "${path}" --values "${filePath}"`, { shell: true })) {
        console.error(`❌ values/${file} validation failed for ${name}`);
        success = false;
      } else {
        console.error(`✅ values/${file} is valid`);
      }
    }
  }

  console.error('::endgroup::');
}

console.log(`success=${success}`);

if (!success) {
  console.error('Schema validation failed');
  process.exit(1);
}

console.error('All schema validations passed');
