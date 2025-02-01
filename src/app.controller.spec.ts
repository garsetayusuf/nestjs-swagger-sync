import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { SwaggerSyncModule } from './swagger-sync/swagger-sync.module';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [
        SwaggerSyncModule.register({
          apiKey: '',
          swaggerPath: '',
          baseUrl: 'http://localhost:3000',
        }),
      ],
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toMatchObject({
        message: 'Hello World!',
      });
    });
  });
});
