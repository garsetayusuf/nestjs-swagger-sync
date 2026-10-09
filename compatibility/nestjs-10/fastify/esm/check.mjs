import { execFileSync } from 'node:child_process';
import { runCompatCheck } from '../../../shared/bootstrap.mjs';

execFileSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.json'], {
  cwd: new URL('.', import.meta.url),
  stdio: 'inherit',
});

await runCompatCheck({
  adapter: 'fastify',
  packageName: 'nestjs-swagger-sync',
  appFactoryUrl: new URL('./dist/main.js', import.meta.url).href,
  fixtureDir: new URL('.', import.meta.url).pathname,
  checkPlan: true,
});
