import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiTestService } from '../../src/swagger-sync/api-test.service.js';
import type { PostmanCollection } from '../../src/swagger-sync/postman-collection.js';

type Sender = Pick<AxiosInstance, 'request'>;

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

function mockSender(sender: unknown): void {
  mockedAxios.create.mockReturnValue(sender as Sender as AxiosInstance);
}

function collection(): PostmanCollection {
  return {
    info: { name: 'Test', description: '', schema: 'schema' },
    variable: [],
    item: [
      {
        name: 'users',
        item: [
          {
            name: 'List users',
            request: {
              method: 'GET',
              header: [{ key: 'Accept', value: 'application/json' }],
              url: {
                raw: '{{baseUrl}}/users',
                host: ['{{baseUrl}}'],
                path: ['users'],
              },
            },
            response: [],
          },
        ],
      },
    ],
  };
}

describe('ApiTestService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSender(mockedAxios);
  });

  it('marks HTTP error statuses as failures instead of passes', async () => {
    const sender = vi.fn().mockResolvedValue({ status: 401, data: 'denied' });
    mockSender(sender);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const service = new ApiTestService();

    await service.runTestsInBackground(collection(), 'http://localhost:3000');

    expect(sender).toHaveBeenCalledOnce();
    const output = log.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('Total requests: 0 passed  ·  1 failed');
    log.mockRestore();
  });

  it('ignores overlapping runs through the isRunning guard', async () => {
    let calls = 0;
    const sender = vi.fn().mockImplementation(async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { status: 200, data: { ok: true } };
    });
    mockSender(sender);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const service = new ApiTestService();

    await Promise.all([
      service.runTestsInBackground(collection(), 'http://localhost:3000'),
      service.runTestsInBackground(collection(), 'http://localhost:3000'),
    ]);

    expect(calls).toBe(1);
    log.mockRestore();
  });

  it('handles empty collections without NaN statistics', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const service = new ApiTestService();
    const empty: PostmanCollection = {
      info: { name: 'Empty', description: '', schema: 'schema' },
      variable: [],
      item: [],
    };

    await service.runTestsInBackground(empty, 'http://localhost:3000');

    const output = log.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).not.toContain('NaN');
    log.mockRestore();
  });
});
