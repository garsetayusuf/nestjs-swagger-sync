import { Module } from '@nestjs/common';
import { SwaggerSyncModule } from '.';
import { AppController } from './app.controller';

@Module({
  imports: [
    SwaggerSyncModule.register({
      apiKey: 'your-postman-api-key',
      swaggerPath: 'api',
      port: 3000,
      collectionName: 'My API Collection',
      runTests: true,
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
