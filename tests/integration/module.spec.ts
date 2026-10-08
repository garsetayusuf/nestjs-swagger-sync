import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { SwaggerSyncModule } from '../../src/swagger-sync/swagger-sync.module.js';
import { SwaggerSyncService } from '../../src/swagger-sync/swagger-sync.service.js';
import { baseConfig } from '../helpers/fixtures.js';

describe('SwaggerSyncModule registration', () => {
  it('resolves SwaggerSyncService with metadata-based DI', async () => {
    const module = await Test.createTestingModule({
      imports: [SwaggerSyncModule.register(baseConfig())],
    }).compile();

    const service = module.get(SwaggerSyncService);
    expect(service).toBeInstanceOf(SwaggerSyncService);
    expect(typeof service.syncSwagger).toBe('function');

    await module.close();
  });
});
