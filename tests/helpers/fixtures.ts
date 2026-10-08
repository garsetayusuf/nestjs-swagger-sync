import type { SwaggerSyncConfig } from '../../src/swagger-sync/interfaces/swagger-sync-config.interface.js';

export function baseConfig(overrides: Partial<SwaggerSyncConfig> = {}): SwaggerSyncConfig {
  return {
    apiKey: 'test-key',
    swaggerPath: 'api',
    baseUrl: 'http://localhost:3000',
    runTest: false,
    ...overrides,
  };
}

export function sampleSwaggerDocument() {
  return {
    info: { title: 'Test API', description: 'Test description' },
    paths: {
      '/users': { get: { summary: 'List users' } },
      '/users/{id}': { get: { summary: 'Get user' } },
      '/auth/login': { post: { summary: 'Login' } },
    },
  };
}

export function deferred<T>() {
  return Promise.withResolvers<T>();
}
