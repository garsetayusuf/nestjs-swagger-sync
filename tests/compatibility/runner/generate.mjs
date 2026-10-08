// Generates real NestJS application fixtures from the compatibility matrix.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const compatDir = join(here, '..');
const { allScenarios, scenarioDir } = await import('../matrix.mjs');

const SWAGGER_VERSION = {
  6: '3.1.0',
  7: '4.8.2',
  8: '5.2.1',
  9: '6.3.0',
  10: '7.4.2',
  11: '11.4.7',
  12: '12.0.2',
};

const SWAGGER_EXTRA = {
  6: { 'fastify-swagger': '2.6.0' },
  7: { 'fastify-swagger': '4.8.2' },
  8: { 'fastify-swagger': '5.0.0' },
  9: { '@fastify/static': '6.12.0' },
  10: { '@fastify/static': '7.0.4' },
  11: { '@fastify/static': '10.1.5' },
  12: { '@fastify/static': '10.1.5' },
};

const APP_SERVICE = `import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
`;

function appController(moduleSuffix) {
  return `import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service${moduleSuffix}';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('hello')
  getHello(): string {
    return this.appService.getHello();
  }
}
`;
}

function appModule(moduleSuffix) {
  return `import { Module } from '@nestjs/common';
import { AppController } from './app.controller${moduleSuffix}';
import { AppService } from './app.service${moduleSuffix}';

@Module({
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
`;
}

function mainSource(adapter, moduleSuffix, nestjs) {
  const adapterImport =
    adapter === 'fastify' ? "import { FastifyAdapter } from '@nestjs/platform-fastify';\n" : '';
  const adapterArg = adapter === 'fastify' ? ', new FastifyAdapter()' : '';
  const authLine = nestjs === '6' ? ".addBearerAuth('JWT')" : ".addBearerAuth({ type: 'http' })";
  return `import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
${adapterImport}import { AppModule } from './app.module${moduleSuffix}';

export async function createApp() {
  const app = await NestFactory.create(AppModule${adapterArg}, { logger: false });
  const config = new DocumentBuilder()
    .setTitle('Compatibility API NestJS ${nestjs}')
    .setDescription('Real compatibility fixture')
    .setVersion('1.0.0')
    ${authLine}
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  return app;
}
`;
}

function tsConfig(module) {
  return (
    JSON.stringify(
      {
        compilerOptions: {
          module: module === 'esm' ? 'nodenext' : 'commonjs',
          moduleResolution: module === 'esm' ? 'nodenext' : 'node',
          target: 'ES2020',
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          esModuleInterop: true,
          strict: true,
          skipLibCheck: true,
          ignoreDeprecations: '6.0',
          outDir: './dist',
          rootDir: './src',
        },
        include: ['src/**/*.ts'],
      },
      null,
      2,
    ) + '\n'
  );
}

function packageManifest(scenario) {
  const swagger = SWAGGER_VERSION[scenario.nestjs];
  const dependencies = {
    '@nestjs/common': scenario.nestVersion,
    '@nestjs/core': scenario.nestVersion,
    [`@nestjs/platform-${scenario.adapter}`]: scenario.nestVersion,
    '@nestjs/swagger': swagger,
    'nestjs-swagger-sync': 'file:../../../../../nestjs-swagger-sync-6.6.1.tgz',
    'reflect-metadata': '^0.2.0',
    rxjs: scenario.nestjs === '6' ? '^6.6.7' : '^7.8.0',
    'swagger-ui-express': '4.1.6',
    ...((scenario.adapter === 'fastify' && SWAGGER_EXTRA[scenario.nestjs]) || {}),
  };
  return (
    JSON.stringify(
      {
        name: `compat-nestjs-${scenario.nestjs}-${scenario.adapter}-${scenario.module}`,
        version: '0.0.0',
        private: true,
        type: scenario.module === 'esm' ? 'module' : 'commonjs',
        dependencies,
        devDependencies: {
          '@nestjs/testing': scenario.nestVersion,
          '@types/node': '^24.0.0',
          typescript: '^6.0.3',
        },
      },
      null,
      2,
    ) + '\n'
  );
}

function checkEsm(adapter) {
  return `import { execFileSync } from 'node:child_process';
import { runCompatCheck } from '../../../shared/bootstrap.mjs';

execFileSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.json'], {
  cwd: new URL('.', import.meta.url),
  stdio: 'inherit',
});

await runCompatCheck({
  adapter: '${adapter}',
  packageName: 'nestjs-swagger-sync',
  appFactoryUrl: new URL('./dist/main.js', import.meta.url).href,
  fixtureDir: new URL('.', import.meta.url).pathname,
  checkPlan: true,
});
`;
}

function checkCjs(adapter) {
  return `const { execFileSync } = require('node:child_process');
const { runCompatCheck } = require('../../../shared/bootstrap.cjs');

execFileSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.json'], {
  cwd: __dirname,
  stdio: 'inherit',
});

runCompatCheck({
  adapter: '${adapter}',
  packageName: 'nestjs-swagger-sync',
  appFactoryUrl: require.resolve('./dist/main.js'),
  fixtureDir: __dirname,
  checkPlan: true,
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`;
}

for (const scenario of allScenarios()) {
  const dir = join(compatDir, scenarioDir(scenario));
  const sourceDir = join(dir, 'src');
  mkdirSync(sourceDir, { recursive: true });
  const suffix = scenario.module === 'esm' ? '.js' : '';
  writeFileSync(join(dir, 'package.json'), packageManifest(scenario));
  writeFileSync(
    join(dir, 'pnpm-workspace.yaml'),
    "allowBuilds:\n  '@nestjs/core': true\n  'es5-ext': true\n",
  );
  writeFileSync(join(dir, 'tsconfig.json'), tsConfig(scenario.module));
  writeFileSync(join(sourceDir, 'app.service.ts'), APP_SERVICE);
  writeFileSync(join(sourceDir, 'app.controller.ts'), appController(suffix));
  writeFileSync(join(sourceDir, 'app.module.ts'), appModule(suffix));
  writeFileSync(join(sourceDir, 'main.ts'), mainSource(scenario.adapter, suffix, scenario.nestjs));
  if (scenario.module === 'esm') {
    writeFileSync(join(dir, 'check.mjs'), checkEsm(scenario.adapter));
  } else {
    writeFileSync(join(dir, 'check.cjs'), checkCjs(scenario.adapter));
  }
}
console.log(`Generated ${allScenarios().length} real fixtures`);
