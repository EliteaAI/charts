import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const chartsDir = process.argv[2] || 'charts';
const charts = [];

for (const entry of readdirSync(chartsDir)) {
  const chartPath = join(chartsDir, entry);

  if (!statSync(chartPath).isDirectory()) continue;

  const chartYaml = join(chartPath, 'Chart.yaml');
  if (!existsSync(chartYaml)) {
    console.error(`Skipping ${chartPath} (no Chart.yaml)`);
    continue;
  }

  const content = readFileSync(chartYaml, 'utf8');
  const name = content.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const version = content.match(/^version:\s*(.+)$/m)?.[1]?.trim();

  if (name && version) {
    charts.push({ name, path: chartPath, version });
  }
}

console.log(`charts=${JSON.stringify(charts)}`);
console.error('Charts found:', JSON.stringify(charts, null, 2));
