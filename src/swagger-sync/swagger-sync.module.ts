import { Global, Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { SwaggerSyncService } from './swagger-sync.service.js';
import type { SwaggerSyncConfig } from './interfaces/swagger-sync-config.interface.js';
import { SWAGGER_SYNC_OPTIONS } from './constants/constants.js';
import { ApiTestService } from './api-test.service.js';

@Global()
@Module({})
export class SwaggerSyncModule {
  static register(options: SwaggerSyncConfig): DynamicModule {
    return {
      module: SwaggerSyncModule,
      providers: [
        {
          provide: SWAGGER_SYNC_OPTIONS,
          useValue: options,
        },
        SwaggerSyncService,
        ApiTestService,
      ],
      exports: [SwaggerSyncService, ApiTestService],
    };
  }
}
