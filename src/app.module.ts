import { Module } from '@nestjs/common';
import { SwaggerSyncModule } from '.';
import { AppController } from './app.controller';

@Module({
  imports: [
    SwaggerSyncModule.register({
      apiKey: 'your-postman-api-key',
      swaggerPath: 'api',
      baseUrl: 'http://localhost:3000',
      collectionName: 'My API Collection',
      runTests: true,
      ignoreVariablesPathWithBearerToken: ['api/auth/login'],
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
