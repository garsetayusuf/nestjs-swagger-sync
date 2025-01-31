import { Test, TestingModule } from '@nestjs/testing';
import { SwaggerSyncService } from './swagger-sync.service';

describe('SwaggerSyncService', () => {
  let service: SwaggerSyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SwaggerSyncService],
    }).compile();

    service = module.get<SwaggerSyncService>(SwaggerSyncService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
