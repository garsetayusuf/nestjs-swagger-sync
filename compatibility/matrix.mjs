const NEST_VERSIONS = {
  6: '6.10.14',
  7: '7.6.18',
  8: '8.4.7',
  9: '9.4.3',
  10: '10.4.22',
  11: '11.2.7',
  12: '12.1.2',
};

// Primary Node runtime per NestJS major, from the plan's candidate matrix.
// Local evidence: all 28 scenarios pass on Node 24. CI runs the primary
// historical candidates with setup-node.
const PRIMARY_NODE = {
  6: '14',
  7: '16',
  8: '16',
  9: '18',
  10: '20',
  11: '22',
  12: '24',
};

export function allScenarios() {
  const scenarios = [];
  for (const [nestjs, nestVersion] of Object.entries(NEST_VERSIONS)) {
    for (const adapter of ['express', 'fastify']) {
      for (const module of ['cjs', 'esm']) {
        scenarios.push({
          nestjs,
          nestVersion,
          adapter,
          module,
          node: PRIMARY_NODE[nestjs] ?? '24',
        });
      }
    }
  }
  return scenarios;
}

export function scenarioDir(scenario) {
  return `nestjs-${scenario.nestjs}/${scenario.adapter}/${scenario.module}`;
}
