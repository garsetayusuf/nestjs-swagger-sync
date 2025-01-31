import { Controller, Get } from '@nestjs/common';
import { SwaggerSyncService } from './swagger-sync/swagger-sync.service';

@Controller()
export class AppController {
  constructor(private readonly swaggerSyncService: SwaggerSyncService) {}

  @Get('sync')
  async syncSwagger() {
    await this.swaggerSyncService.syncSwagger();
    return { message: 'Swagger documentation synced with Postman' };
  }

  @Get('hello')
  getHello() {
    return { message: 'Hello World!' };
  }
}
