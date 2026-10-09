import { NestFactory } from '@nestjs/core';
import type { DynamicModule } from '@nestjs/common';
import type { SwaggerSyncConfig } from './interfaces/swagger-sync-config.interface.js';
import { SwaggerSyncModule } from './swagger-sync.module.js';
import { SwaggerSyncService } from './swagger-sync.service.js';

/**
 * Runs one sync against a Swagger endpoint exposed by an already-running app.
 * This creates a Nest application context only; it does not listen or mount Swagger.
 */
export async function runSwaggerSync(options: SwaggerSyncConfig): Promise<void> {
  const rootModule: DynamicModule = {
    module: class StandaloneSwaggerSyncModule {},
    imports: [SwaggerSyncModule.register(options)],
  };
  const context = await NestFactory.createApplicationContext(rootModule);
  try {
    await context.get(SwaggerSyncService).syncSwagger();
  } finally {
    await context.close();
  }
}
