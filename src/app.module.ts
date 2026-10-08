import { Module } from '@nestjs/common';
import { SwaggerSyncModule } from './index.js';
import { AppController } from './app.controller.js';

@Module({
  imports: [
    SwaggerSyncModule.register({
      apiKey: 'your-postman-api-key',
      baseUrl: 'http://localhost:3000',
      swaggerPath: 'swagger',
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
