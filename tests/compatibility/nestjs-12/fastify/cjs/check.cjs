const { execFileSync } = require('node:child_process');
const { runCompatCheck } = require('../../../shared/bootstrap.cjs');

execFileSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.json'], {
  cwd: __dirname,
  stdio: 'inherit',
});

runCompatCheck({
  adapter: 'fastify',
  packageName: 'nestjs-swagger-sync',
  appFactoryUrl: require.resolve('./dist/main.js'),
  fixtureDir: __dirname,
  checkPlan: true,
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
