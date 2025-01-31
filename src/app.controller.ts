import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SwaggerSyncService } from './swagger-sync/swagger-sync.service';

@ApiTags('API')
@Controller()
export class AppController {
  constructor(private readonly swaggerSyncService: SwaggerSyncService) {}

  @Get('sync')
  @ApiOperation({ summary: 'Sync Swagger docs with Postman' })
  async syncSwagger() {
    await this.swaggerSyncService.syncSwagger();
    return { message: 'Swagger documentation synced with Postman' };
  }

  @Get('hello')
  @ApiOperation({ summary: 'Sample endpoint' })
  getHello() {
    return { message: 'Hello World!' };
  }
}
