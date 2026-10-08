import type { SwaggerDocument } from './swagger-sync.service.js';
import type { ContractChange, SyncPlan } from './interfaces/sync-plan.interface.js';
import type { PostmanCollection } from './postman-collection.js';

export interface ContractEndpoint {
  method: string;
  path: string;
  summary: string;
  auth: boolean;
}

export function normalizeSwaggerEndpoints(document: SwaggerDocument): ContractEndpoint[] {
  return Object.entries(document.paths)
    .flatMap(([path, methods]) =>
      Object.entries(methods).map(([method, details]) => ({
        method: method.toUpperCase(),
        path: normalizePath(path),
        summary: details.summary ?? '',
        auth: true,
      })),
    )
    .sort(compareEndpoints);
}

export function normalizePostmanEndpoints(collection: PostmanCollection): ContractEndpoint[] {
  const result: ContractEndpoint[] = [];
  const walk = (nodes: PostmanCollection['item']): void => {
    for (const node of nodes) {
      if ('item' in node) {
        walk(node.item);
      } else {
        result.push({
          method: node.request.method.toUpperCase(),
          path: normalizePath(`/${node.request.url.path.join('/')}`),
          summary: node.name,
          auth: node.request.header.some((header) => header.key.toLowerCase() === 'authorization'),
        });
      }
    }
  };
  walk(collection.item);
  return result.sort(compareEndpoints);
}

export function diffContracts(
  desired: ContractEndpoint[],
  current: ContractEndpoint[],
): Pick<SyncPlan, 'changes' | 'counts' | 'blocked' | 'warnings'> {
  const normalizedCurrent = current.map((endpoint) => ({
    ...endpoint,
    method: endpoint.method.toUpperCase(),
    path: normalizePath(endpoint.path),
  }));
  const desiredMap = new Map(desired.map((endpoint) => [endpointKey(endpoint), endpoint]));
  const currentMap = new Map(
    normalizedCurrent.map((endpoint) => [endpointKey(endpoint), endpoint]),
  );
  const changes: ContractChange[] = [];

  for (const endpoint of desired) {
    const key = endpointKey(endpoint);
    const previous = currentMap.get(key);
    if (!previous) {
      changes.push({
        kind: 'endpoint-added',
        severity: 'safe',
        method: endpoint.method,
        path: endpoint.path,
        summary: `Add ${endpoint.method} ${endpoint.path}`,
        after: endpoint,
      });
      continue;
    }
    if (previous.summary !== endpoint.summary) {
      changes.push({
        kind: 'metadata-changed',
        severity: 'review',
        method: endpoint.method,
        path: endpoint.path,
        summary: `Metadata changed for ${endpoint.method} ${endpoint.path}`,
        before: previous,
        after: endpoint,
      });
    }
    if (previous.auth !== endpoint.auth) {
      changes.push({
        kind: 'auth-changed',
        severity: 'breaking',
        method: endpoint.method,
        path: endpoint.path,
        summary: `Authentication changed for ${endpoint.method} ${endpoint.path}`,
        before: previous,
        after: endpoint,
      });
    }
  }

  for (const endpoint of normalizedCurrent) {
    if (!desiredMap.has(endpointKey(endpoint))) {
      changes.push({
        kind: 'endpoint-removed',
        severity: 'breaking',
        method: endpoint.method,
        path: endpoint.path,
        summary: `Remove ${endpoint.method} ${endpoint.path}`,
        before: endpoint,
      });
    }
  }

  changes.sort((left, right) =>
    `${left.method} ${left.path} ${left.kind}`.localeCompare(
      `${right.method} ${right.path} ${right.kind}`,
    ),
  );
  return {
    changes,
    counts: {
      added: changes.filter((change) => change.kind === 'endpoint-added').length,
      removed: changes.filter((change) => change.kind === 'endpoint-removed').length,
      changed: changes.filter(
        (change) => !['endpoint-added', 'endpoint-removed'].includes(change.kind),
      ).length,
      breaking: changes.filter((change) => change.severity === 'breaking').length,
    },
    blocked: false,
    warnings: [],
  };
}

function normalizePath(path: string): string {
  return `/${path.replace(/^\/+/, '').replace(/\/+$/, '')}`;
}

function endpointKey(endpoint: ContractEndpoint): string {
  return `${endpoint.method} ${endpoint.path}`;
}

function compareEndpoints(left: ContractEndpoint, right: ContractEndpoint): number {
  return endpointKey(left).localeCompare(endpointKey(right));
}
