export function formatDuration(durationMs) {
  if (durationMs < 60000) {
    return `${(durationMs / 1000).toFixed(2)}s`;
  }
  const minutes = Math.floor(durationMs / 60000);
  const seconds = ((durationMs % 60000) / 1000).toFixed(2);
  return `${minutes}m ${seconds}s`;
}

export function summarizeCompatibility(results, metadata) {
  const passed = results.filter((result) => result.status === 'passed').length;
  const failed = results.filter((result) => result.status === 'failed').length;
  const unsupported = results.filter((result) => result.status === 'unsupported').length;
  const notRun = results.filter((result) => result.status === 'not executed').length;
  const selected = results.length - notRun;
  const passRate = selected === 0 ? 0 : Number(((passed / selected) * 100).toFixed(2));
  const status = failed > 0 ? 'failed' : unsupported > 0 ? 'unsupported' : 'passed';

  return {
    status,
    total: results.length,
    selected,
    passed,
    failed,
    unsupported,
    notRun,
    passRate,
    durationMs: metadata.durationMs,
    runtime: metadata.runtime,
    packageName: metadata.packageName,
    packageVersion: metadata.packageVersion,
    artifact: metadata.artifact,
  };
}

export function summaryText(summary) {
  return [
    'Compatibility summary',
    '─────────────────────',
    `Status       ${summary.status.toUpperCase()}`,
    `Scenarios    ${summary.selected} selected / ${summary.total} total`,
    `Passed       ${summary.passed}`,
    `Failed       ${summary.failed}`,
    `Unsupported  ${summary.unsupported}`,
    `Not run      ${summary.notRun}`,
    `Pass rate    ${summary.passRate.toFixed(2)}% of selected`,
    `Duration     ${formatDuration(summary.durationMs)}`,
    `Runtime      Node ${summary.runtime}`,
    `Package      ${summary.packageName}@${summary.packageVersion}`,
    `Artifact     ${summary.artifact}`,
  ].join('\n');
}

export function failureDetailsText(results) {
  const failures = results.filter((result) => result.status === 'failed');
  if (failures.length === 0) return '';

  return [
    'Failure details',
    '───────────────',
    ...failures.map((result) => {
      const reason =
        String(result.reason ?? 'unknown failure')
          .split('\n')
          .map((line) => line.trim())
          .find(Boolean) ?? 'unknown failure';
      return `✗ ${result.scenario} [Node ${result.node}] — ${reason.slice(0, 160)}`;
    }),
  ].join('\n');
}
