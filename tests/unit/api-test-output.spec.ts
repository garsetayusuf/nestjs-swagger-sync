import { createServer } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { ApiTestService } from '../../src/swagger-sync/api-test.service.js';
import type { PostmanCollection } from '../../src/swagger-sync/postman-collection.js';
const collection: PostmanCollection = {
  info: {
    name: 'Output test',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: [
    {
      name: 'blocked-one',
      request: { method: 'GET', url: { raw: '', host: [], path: ['blocked-one'] }, header: [] },
    },
    {
      name: 'blocked-two',
      request: { method: 'GET', url: { raw: '', host: [], path: ['blocked-two'] }, header: [] },
    },
  ],
};

describe('ApiTestService table output', () => {
  it('shows colored result data with endpoint details', async () => {
    const service = new ApiTestService();
    const server = createServer((_request, response) => {
      response.statusCode = 403;
      response.end(JSON.stringify({ message: 'Missing csrf secret' }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Test server did not expose a port');

    const output: string[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation((message?: unknown) => {
      output.push(String(message ?? ''));
    });

    try {
      await service.runTestsInBackground(collection, `http://127.0.0.1:${address.port}`);
    } finally {
      log.mockRestore();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }

    const text = output.join('\n');
    expect(text).toContain('Pass rate: 0.00%');
    expect(text).toContain('Status breakdown: 403: 2');
    expect(text).toContain('Blocked: 2');
    expect(text).toContain('Timeouts: 0');
  });
});
