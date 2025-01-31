import { Controller, Post } from '@nestjs/common';
import { SwaggerSyncService } from './swagger-sync';

@Controller()
export class AppController {
  constructor(private readonly swaggerSyncService: SwaggerSyncService) {}

  @Post('sync')
  async syncSwagger() {
    await this.swaggerSyncService.syncSwagger();
    return { message: 'Swagger documentation synced with Postman' };
  }
}
