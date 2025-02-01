import { Test, TestingModule } from '@nestjs/testing';
import { SwaggerSyncService } from './swagger-sync.service';
import { SWAGGER_SYNC_OPTIONS } from './constants/constants';
import { ApiTestService } from './api-test.service';

describe('SwaggerSyncService', () => {
  let service: SwaggerSyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SwaggerSyncService,
        ApiTestService,
        {
          provide: SWAGGER_SYNC_OPTIONS,
          useValue: {
            baseUrl: 'http://localhost:3000',
          },
        },
      ],
    }).compile();

    service = module.get<SwaggerSyncService>(SwaggerSyncService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
