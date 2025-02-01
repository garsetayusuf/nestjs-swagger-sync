import { Module } from '@nestjs/common';
import { SwaggerSyncModule } from '.';
import { AppController } from './app.controller';

@Module({
  imports: [
    SwaggerSyncModule.register({
      apiKey: 'your-postman-api-key',
      baseUrl: 'http://localhost:3000',
      swaggerPath: 'swagger',
      runTests: true,
      ignoreVariablesPathWithBearerToken: ['api/auth/login'],
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
