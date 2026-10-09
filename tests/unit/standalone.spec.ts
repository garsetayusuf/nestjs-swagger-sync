import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { runSwaggerSync } from '../../src/swagger-sync/standalone.js';

describe('runSwaggerSync', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => (error ? reject(error) : resolve()));
      });
      server = undefined;
    }
  });

  it('fetches Swagger JSON from an already-running app without starting a listener', async () => {
    const requests: string[] = [];
    server = createServer((request, response) => {
      requests.push(request.url ?? '');
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({ openapi: '3.0.0', info: { title: 'Standalone API' }, paths: {} }),
      );
    });
    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Test server did not expose a port');

    await runSwaggerSync({
      apiKey: '',
      swaggerPath: 'swagger',
      baseUrl: `http://127.0.0.1:${address.port}`,
      runTest: false,
      dryRun: true,
    });

    expect(requests).toContain('/swagger-json');
  });
});
