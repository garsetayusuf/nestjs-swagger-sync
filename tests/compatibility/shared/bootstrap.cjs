// CJS compatibility bootstrap for both synthetic and real fixtures.
const { createRequire } = require('node:module');

async function runCompatCheck({
  adapter,
  packageName,
  appModuleUrl,
  appFactoryUrl,
  fixtureDir,
  checkPlan = false,
}) {
  const require = createRequire(`${fixtureDir}/package.json`);
  const pkg = require(packageName);
  const { NestFactory } = require('@nestjs/core');
  const platform =
    adapter === 'fastify'
      ? require('@nestjs/platform-fastify').FastifyAdapter
      : require('@nestjs/platform-express').ExpressAdapter;

  const app = appFactoryUrl
    ? await require(appFactoryUrl).createApp()
    : await NestFactory.create(resolveAppModule(require(appModuleUrl)), new platform(), {
        logger: false,
      });
  await app.listen(0);
  const url = await app.getUrl();
  let response;
  try {
    const res = await fetch(`${url}/hello`);
    const raw = await res.text();
    let body = raw;
    try {
      body = JSON.parse(raw);
    } catch {
      // Real NestJS 7 sample returns plain text; newer fixtures may return JSON.
    }
    response = { status: res.status, body };
  } finally {
    // Keep the real app alive until previewSync() fetches /api-json.
  }

  const { Test } = require('@nestjs/testing');
  const syncModule = await Test.createTestingModule({
    imports: [
      pkg.SwaggerSyncModule.register({
        apiKey: '',
        swaggerPath: 'api',
        baseUrl: url,
        runTest: false,
        dryRun: true,
      }),
    ],
  }).compile();
  const syncService = syncModule.get(pkg.SwaggerSyncService);
  let plan = undefined;
  if (checkPlan) {
    plan = await syncService.previewSync();
  }
  const resolved = !!syncService && typeof syncService.syncSwagger === 'function';
  await syncModule.close();
  await app.close();
  const helloOk =
    response.status === 200 &&
    (response.body === 'Hello World!' || response.body?.message === 'Hello World!');
  if (!helloOk) {
    throw new Error(`Unexpected hello response: ${JSON.stringify(response)}`);
  }
  if (!resolved) {
    throw new Error('SwaggerSyncService failed to resolve');
  }
  if (checkPlan && (!plan || plan.collection.item.length === 0)) {
    throw new Error('Contract preview contained no generated endpoints');
  }
  console.log(`COMPAT_OK adapter=${adapter} status=200 di=ok plan=${checkPlan ? 'ok' : 'skipped'}`);
}

function resolveAppModule(value) {
  return value.AppModule ?? value.default?.AppModule ?? value.default;
}

module.exports = { runCompatCheck };
