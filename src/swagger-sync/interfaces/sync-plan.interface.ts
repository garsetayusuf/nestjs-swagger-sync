import type { PostmanCollection } from '../postman-collection.js';

export type ChangeKind =
  | 'endpoint-added'
  | 'endpoint-removed'
  | 'method-changed'
  | 'auth-changed'
  | 'request-shape-changed'
  | 'response-shape-changed'
  | 'metadata-changed';

export type ChangeSeverity = 'safe' | 'review' | 'breaking';

export interface ContractChange {
  kind: ChangeKind;
  severity: ChangeSeverity;
  method: string;
  path: string;
  summary: string;
  before?: unknown;
  after?: unknown;
}

export interface SyncPlan {
  collection: PostmanCollection;
  changes: ContractChange[];
  counts: {
    added: number;
    removed: number;
    changed: number;
    breaking: number;
  };
  blocked: boolean;
  warnings: string[];
}
