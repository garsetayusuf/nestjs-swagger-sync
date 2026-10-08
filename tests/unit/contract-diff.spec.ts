import { describe, expect, it } from 'vitest';
import { diffContracts, normalizeSwaggerEndpoints } from '../../src/swagger-sync/contract-diff.js';

const swagger = {
  info: { title: 'API' },
  paths: {
    '/users': { get: { summary: 'List users' } },
    '/users/{id}': { get: { summary: 'Get user' } },
    '/admin': { post: { summary: 'Create admin' } },
  },
};

const existing = [
  { method: 'GET', path: '/users', summary: 'List users', auth: true },
  { method: 'GET', path: '/removed', summary: 'Removed endpoint', auth: true },
  { method: 'GET', path: '/users/{id}', summary: 'Old summary', auth: true },
];

describe('contract diff', () => {
  it('classifies additions, removals, and metadata changes deterministically', () => {
    const result = diffContracts(normalizeSwaggerEndpoints(swagger), existing);

    expect(result.changes).toHaveLength(3);
    expect(result.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'endpoint-added',
          method: 'POST',
          path: '/admin',
          severity: 'safe',
        }),
        expect.objectContaining({
          kind: 'endpoint-removed',
          method: 'GET',
          path: '/removed',
          severity: 'breaking',
        }),
        expect.objectContaining({
          kind: 'metadata-changed',
          method: 'GET',
          path: '/users/{id}',
          severity: 'review',
        }),
      ]),
    );
    expect(result.counts).toEqual({
      added: 1,
      removed: 1,
      changed: 1,
      breaking: 1,
    });
    expect(result.blocked).toBe(false);
  });

  it('normalizes method casing and leading slashes', () => {
    const result = diffContracts(
      normalizeSwaggerEndpoints({ info: {}, paths: { users: { get: {} } } }),
      [{ method: 'get', path: '/users', summary: '', auth: true }],
    );

    expect(result.changes).toEqual([]);
  });
});
