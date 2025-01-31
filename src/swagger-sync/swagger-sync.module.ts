import { DynamicModule, Module } from '@nestjs/common';
import { SwaggerSyncService } from './swagger-sync.service';
import { SwaggerSyncConfig } from './interfaces/swagger-sync-config.interface';
import { SWAGGER_SYNC_OPTIONS } from './constants/constants';

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
      ],
      exports: [SwaggerSyncService],
    };
  }
}
