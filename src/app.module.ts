import { Module } from '@nestjs/common';
import { SwaggerSyncModule } from './swagger-sync';

@Module({
  imports: [
    SwaggerSyncModule.register({
      apiKey: 'your-postman-api-key',
      port: 3000,
      baseUrl: 'http://localhost:3000',
      collectionName: 'My API Collection',
      runTests: true,
    }),
  ],
})
export class AppModule {}
