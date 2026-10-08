import axios from 'axios';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SwaggerSyncService } from '../../src/swagger-sync/swagger-sync.service.js';
import { ApiTestService } from '../../src/swagger-sync/api-test.service.js';
import { SWAGGER_SYNC_OPTIONS } from '../../src/swagger-sync/constants/constants.js';
import type { PostmanCollection } from '../../src/swagger-sync/postman-collection.js';
import { baseConfig, deferred, sampleSwaggerDocument } from '../helpers/fixtures.js';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

async function createService(overrides: Parameters<typeof baseConfig>[0] = {}) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      SwaggerSyncService,
      ApiTestService,
      { provide: SWAGGER_SYNC_OPTIONS, useValue: baseConfig(overrides) },
    ],
  }).compile();
  return module.get(SwaggerSyncService);
}

function collectionResponse(name: string, uid = 'uid-1') {
  return {
    status: 200,
    data: { collections: [{ name, uid }] },
  };
}

function collectionDetailResponse(name: string): {
  status: number;
  data: { collection: PostmanCollection };
} {
  return {
    status: 200,
    data: {
      collection: {
        info: { name, description: '', schema: '' },
        variable: [],
        item: [],
      },
    },
  };
}
describe('SwaggerSyncService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedAxios.get.mockResolvedValue({ status: 200, data: {} });
    mockedAxios.isAxiosError.mockReturnValue(false);
  });

  it('rejects an invalid base URL at construction', async () => {
    await expect(createService({ baseUrl: 'not-a-url' })).rejects.toThrow(
      'Invalid base URL: not-a-url',
    );
  });

  it('returns immediately while a sync is already running', async () => {
    const gate = deferred<unknown>();
    mockedAxios.get.mockReturnValueOnce(gate.promise);
    mockedAxios.get.mockResolvedValueOnce(collectionResponse('Test API'));
    mockedAxios.mockResolvedValueOnce({ status: 200, data: {} });

    const service = await createService();
    const first = service.syncSwagger();
    await service.syncSwagger();
    gate.resolve({ status: 200, data: sampleSwaggerDocument() });
    await first;

    expect(mockedAxios.get).toHaveBeenCalledTimes(3);
  });

  it('fetches the swagger JSON document over the configured path', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: sampleSwaggerDocument(),
    });
    mockedAxios.get.mockResolvedValueOnce(collectionResponse('Test API'));
    mockedAxios.mockResolvedValueOnce({ status: 200, data: {} });

    const service = await createService();
    await service.syncSwagger();

    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api-json',
      expect.objectContaining({ validateStatus: expect.any(Function) }),
    );
  });

  it('creates a collection when no name match exists', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: sampleSwaggerDocument(),
    });
    mockedAxios.get.mockResolvedValueOnce(collectionResponse('Other collection'));
    mockedAxios.get.mockResolvedValueOnce(collectionResponse('Other collection'));
    mockedAxios.mockResolvedValueOnce({ status: 201, data: {} });

    const service = await createService();
    await service.syncSwagger();

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'post',
        url: 'https://api.getpostman.com/collections',
      }),
    );
  });

  it('updates the matching collection by uid', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: sampleSwaggerDocument(),
    });
    mockedAxios.get.mockResolvedValueOnce(collectionResponse('Test API'));
    mockedAxios.get.mockResolvedValueOnce(collectionDetailResponse('Test API'));
    mockedAxios.get.mockResolvedValueOnce(collectionResponse('Test API'));
    mockedAxios.mockResolvedValueOnce({ status: 200, data: {} });

    const service = await createService();
    await service.syncSwagger();

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'put',
        url: 'https://api.getpostman.com/collections/uid-1',
      }),
    );
  });

  it('skips the Postman upload when the API key is empty', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: sampleSwaggerDocument(),
    });

    const service = await createService({ apiKey: '' });
    await service.syncSwagger();

    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(mockedAxios).not.toHaveBeenCalled();
  });

  it('returns false without uploading on Postman auth failure', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: sampleSwaggerDocument(),
    });
    mockedAxios.get.mockResolvedValueOnce({ status: 401, data: {} });

    const service = await createService();
    await service.syncSwagger();

    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    expect(mockedAxios).not.toHaveBeenCalled();
  });

  it('throws on non-2xx collection write instead of silent success', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: sampleSwaggerDocument(),
    });
    mockedAxios.get.mockResolvedValueOnce(collectionResponse('Test API'));
    mockedAxios.get.mockResolvedValueOnce(collectionDetailResponse('Test API'));
    mockedAxios.get.mockResolvedValueOnce(collectionResponse('Test API'));
    mockedAxios.mockResolvedValueOnce({ status: 500, data: {} });

    const service = await createService();
    await service.syncSwagger();

    expect(mockedAxios.get).toHaveBeenCalledTimes(4);
    expect(mockedAxios).toHaveBeenCalledTimes(1);
  });
  it('excludes exact-match ignored paths from collection and auth headers', async () => {
    const swagger = sampleSwaggerDocument();
    mockedAxios.get.mockResolvedValueOnce({ status: 200, data: swagger });
    mockedAxios.get.mockResolvedValueOnce(collectionResponse('Test API'));
    mockedAxios.get.mockResolvedValueOnce(collectionDetailResponse('Test API'));
    mockedAxios.get.mockResolvedValueOnce(collectionResponse('Test API'));
    mockedAxios.mockResolvedValueOnce({ status: 200, data: {} });

    const service = await createService({
      ignorePathWithBearerToken: ['/auth/login'],
    });
    await service.syncSwagger();

    const sent = mockedAxios.mock.calls[0]?.[0] as unknown as {
      data: { collection: PostmanCollection };
    };
    const names = JSON.stringify(sent.data.collection.item);
    expect(names).not.toContain('auth');
    expect(names).not.toContain('Login');
  });

  it('propagates malformed swagger documents as logged errors', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: { info: {}, paths: 'broken' },
    });
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: { info: {}, paths: 'broken' },
    });

    const service = await createService();
    await service.syncSwagger();

    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it('falls back to the /json variant when -json misses', async () => {
    mockedAxios.get.mockResolvedValueOnce({ status: 404, data: {} });
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: sampleSwaggerDocument(),
    });
    mockedAxios.get.mockResolvedValueOnce(collectionResponse('Test API'));
    mockedAxios.mockResolvedValueOnce({ status: 200, data: {} });

    const service = await createService();
    await service.syncSwagger();

    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api-json',
      expect.objectContaining({ validateStatus: expect.any(Function) }),
    );
    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/json',
      expect.objectContaining({ validateStatus: expect.any(Function) }),
    );
  });

  it('previews contract changes without mutating Postman', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: sampleSwaggerDocument(),
    });
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: { collections: [] },
    });

    const service = await createService();
    const plan = await service.previewSync();

    expect(plan.collection.info.name).toBe('Test API');
    expect(plan.counts.added).toBeGreaterThan(0);
    expect(mockedAxios).not.toHaveBeenCalled();
  });

  it('skips the Postman upload in dryRun mode', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: sampleSwaggerDocument(),
    });

    const service = await createService({ dryRun: true });
    await service.syncSwagger();

    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(mockedAxios).not.toHaveBeenCalled();
  });

  it('builds a collection without network access', async () => {
    const service = await createService();
    const collection = service.buildCollection(sampleSwaggerDocument());

    expect(collection.info.name).toBe('Test API');
    expect(collection.item.length).toBeGreaterThan(0);
  });
});
