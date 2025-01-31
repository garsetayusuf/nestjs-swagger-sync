import { Module } from '@nestjs/common';
import { SwaggerSyncService } from './swagger-sync.service';

@Module({
  providers: [SwaggerSyncService],
  exports: [SwaggerSyncService],
})
export class SwaggerSyncModule {}
