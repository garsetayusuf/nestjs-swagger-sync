import { Test, TestingModule } from '@nestjs/testing';
import { SwaggerSyncService } from './swagger-sync.service';
import { SWAGGER_SYNC_OPTIONS } from './constants/constants';

describe('SwaggerSyncService', () => {
  let service: SwaggerSyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SwaggerSyncService,
        {
          provide: SWAGGER_SYNC_OPTIONS,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<SwaggerSyncService>(SwaggerSyncService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
