// NVM-aware compatibility runner. Packs once on the dev baseline,
// then installs + checks each fixture under its target Node via NVM
// in isolated shells (never switching the parent process Node).
import { execFileSync } from 'node:child_process';
import chalk from 'chalk';
import { createLogUpdate } from 'log-update';
import Table from 'cli-table3';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allScenarios, scenarioDir } from '../matrix.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const configuredNode = readFileSync(join(root, '.nvmrc'), 'utf8').trim();

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--nestjs') args.nestjs = argv[++i];
    else if (flag === '--adapter') args.adapter = argv[++i];
    else if (flag === '--module') args.module = argv[++i];
    else if (flag === '--node') args.node = argv[++i];
    else if (flag === '--force-node') args.forceNode = argv[++i];
    else if (flag === '--all-nodes') args.allNodes = true;
  }
  return args;
}

function shell(script) {
  try {
    const output = execFileSync('bash', ['-c', script], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, output };
  } catch (error) {
    return {
      code: error.status ?? 1,
      output: `${error.stdout ?? ''}\n${error.stderr ?? ''}`,
    };
  }
}

function withNode(version, command) {
  const resolved = version === '24' ? '24.21.0' : version;
  return [
    'export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"',
    '[ -s "$NVM_DIR/nvm.sh" ] || { echo \'NVM not found\' >&2; exit 1; }',
    '. "$NVM_DIR/nvm.sh"',
    `nvm use ${resolved} >/dev/null 2>&1 || nvm install ${resolved}`,
    'node --version',
    command,
  ].join('\n');
}

function scenarioKey(scenario) {
  return `${scenario.nestjs}/${scenario.adapter}/${scenario.module}`;
}

function labelFor(scenario, node) {
  return `${scenarioDir(scenario)} (node ${node})`;
}

function statusText(status) {
  const styles = {
    pending: chalk.gray('PENDING'),
    running: chalk.cyan('RUNNING'),
    passed: chalk.green('PASSED'),
    failed: chalk.red('FAILED'),
    unsupported: chalk.yellow('UNSUPPORTED'),
    'not executed': chalk.gray('NOT RUN'),
  };
  return styles[status] ?? status;
}
function formatSeconds(durationMs) {
  return durationMs > 0 ? `${(durationMs / 1000).toFixed(2)}s` : '-';
}

function tableText(title, rows) {
  const table = new Table({
    head: [
      chalk.bold('#'),
      chalk.bold('Scenario'),
      chalk.bold('Node'),
      chalk.bold('Status'),
      chalk.bold('Duration'),
    ],
    colWidths: [4, 36, 7, 13, 10],
    wordWrap: false,
  });
  rows.forEach((row, index) => {
    table.push([
      index + 1,
      row.scenario,
      row.node,
      statusText(row.status),
      formatSeconds(row.durationMs),
    ]);
  });
  return `${chalk.bold.cyan(title)}\n${table.toString()}\n`;
}

const liveLogger = process.stdout.isTTY
  ? createLogUpdate(process.stdout, {
      defaultWidth: 120,
    })
  : undefined;

function drawLiveMatrix(title, rows) {
  if (liveLogger) {
    liveLogger(tableText(title, rows));
  }
}

function showFinalMatrix(title, rows) {
  if (liveLogger) {
    liveLogger(tableText(title, rows));
    liveLogger.done();
  } else {
    console.log(`\n${tableText(title, rows)}`);
  }
}
function updateLiveStatus(rows, key, status, node, durationMs = 0) {
  const row = rows.find((entry) => entry.key === key);
  if (row) {
    row.status = status;
    row.node = node;
    row.durationMs = durationMs;
  }
}

const args = parseArgs(process.argv.slice(2));
const matrix = allScenarios();
const scenarios = matrix.filter((scenario) => {
  if (args.nestjs && scenario.nestjs !== args.nestjs) return false;
  if (args.adapter && scenario.adapter !== args.adapter) return false;
  if (args.module && scenario.module !== args.module) return false;
  if (args.node && scenario.node !== args.node) return false;
  return true;
});

if (scenarios.length === 0) {
  console.error('No matching compatibility scenarios.');
  process.exit(2);
}

const selected = new Set(scenarios.map(scenarioKey));
const liveRows = matrix.map((scenario) => ({
  key: scenarioKey(scenario),
  scenario: labelFor(scenario, scenario.node),
  node: scenario.node,
  status: selected.has(scenarioKey(scenario)) ? 'pending' : 'not executed',
  durationMs: 0,
}));
drawLiveMatrix(`Compatibility matrix (${matrix.length} scenarios)`, liveRows);

// Pack once on the development baseline and copy to a stable path so
// fixture installs cannot race with the repository working directory.
const tarball = 'nestjs-swagger-sync-6.6.1.tgz';
const stableTarball = join('/tmp', `nestjs-swagger-sync-${process.pid}.tgz`);
const pack = shell(
  withNode(
    '24',
    `find tests/compatibility -type d \\( -name node_modules -o -name dist \\) -prune -exec rm -rf {} + && rm -f *.tgz && pnpm pack && cp ${JSON.stringify(tarball)} ${JSON.stringify(stableTarball)}`,
  ),
);
if (pack.code !== 0) {
  console.error(pack.output);
  process.exit(1);
}

const activeNode = process.versions.node.split('.')[0];
const defaultNode = configuredNode || activeNode;
const resultsByKey = new Map();

for (const scenario of scenarios) {
  const node = args.forceNode ?? args.node ?? (args.allNodes ? scenario.node : defaultNode);
  const key = scenarioKey(scenario);
  const label = labelFor(scenario, node);
  if (scenario.unsupported && !args.allNodes) {
    updateLiveStatus(liveRows, key, 'unsupported', node);
    drawLiveMatrix(`Compatibility matrix (${matrix.length} scenarios)`, liveRows);
    resultsByKey.set(key, {
      scenario: label,
      node,
      status: 'unsupported',
      reason: scenario.unsupported,
      durationMs: 0,
    });
    continue;
  }

  updateLiveStatus(liveRows, key, 'running', node);
  drawLiveMatrix(`Compatibility matrix (${matrix.length} scenarios)`, liveRows);
  const started = Date.now();
  const dir = join(root, 'tests', 'compatibility', scenarioDir(scenario));
  const script = withNode(
    node,
    [
      `cd ${JSON.stringify(dir)}`,
      'rm -rf node_modules pnpm-lock.yaml package-lock.json',
      'pnpm install --no-frozen-lockfile',
      `pnpm add ${JSON.stringify(stableTarball)}`,
      'node --version',
      scenario.module === 'esm' ? 'node check.mjs' : 'node check.cjs',
    ].join('\n'),
  );
  const outcome = shell(script);
  const result = {
    scenario: label,
    node,
    status: outcome.code === 0 ? 'passed' : 'failed',
    reason: outcome.code === 0 ? 'ok' : outcome.output.slice(-2000),
    durationMs: Date.now() - started,
  };
  resultsByKey.set(key, result);
  updateLiveStatus(liveRows, key, result.status, node, result.durationMs);
  drawLiveMatrix(`Compatibility matrix (${matrix.length} scenarios)`, liveRows);
}

const results = matrix.map((scenario) => {
  const key = scenarioKey(scenario);
  return (
    resultsByKey.get(key) ?? {
      scenario: labelFor(scenario, scenario.node),
      node: scenario.node,
      status: 'not executed',
      reason: 'filtered out',
      durationMs: 0,
    }
  );
});
showFinalMatrix('Final compatibility status', results);

const reportsDir = join(root, 'reports');
mkdirSync(reportsDir, { recursive: true });
writeFileSync(join(reportsDir, 'compatibility.json'), JSON.stringify({ results }, null, 2));
const markdown = [
  '# Compatibility report',
  '',
  '| Scenario | Status | Duration | Reason |',
  '| --- | --- | --- | --- |',
  ...results.map(
    (result) =>
      `| ${result.scenario} | ${result.status} | ${formatSeconds(result.durationMs)} | ${String(result.reason).split('\n')[0]?.slice(0, 120) ?? ''} |`,
  ),
  '',
].join('\n');
writeFileSync(join(reportsDir, 'compatibility.md'), markdown);

const failed = results.filter((result) => result.status === 'failed');
if (failed.length > 0) {
  process.exit(1);
}
