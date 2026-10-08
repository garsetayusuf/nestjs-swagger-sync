import { Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  diffContracts,
  normalizePostmanEndpoints,
  normalizeSwaggerEndpoints,
} from './contract-diff.js';
import type { SwaggerSyncConfig } from './interfaces/swagger-sync-config.interface.js';
import { SWAGGER_SYNC_OPTIONS } from './constants/constants.js';
import { ApiTestService } from './api-test.service.js';
import type { SyncPlan } from './interfaces/sync-plan.interface.js';
import type { CollectionNode, PostmanCollection, PostmanFolder } from './postman-collection.js';

export interface SwaggerDocument {
  info: {
    title?: string;
    description?: string;
  };
  paths: Record<string, Record<string, { summary?: string }>>;
}

interface PostmanCollectionSummary {
  name: string;
  uid: string;
}

function isPostmanCollectionSummary(value: unknown): value is PostmanCollectionSummary {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    'uid' in value &&
    typeof value.uid === 'string'
  );
}
function isPostmanCollectionResponse(value: unknown): value is { collection: PostmanCollection } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'collection' in value &&
    typeof value.collection === 'object' &&
    value.collection !== null &&
    'info' in value.collection &&
    'item' in value.collection
  );
}

function isSwaggerPathsDocument(value: unknown): value is SwaggerDocument {
  return (
    typeof value === 'object' &&
    value !== null &&
    'info' in value &&
    typeof value.info === 'object' &&
    value.info !== null &&
    'paths' in value &&
    typeof value.paths === 'object' &&
    value.paths !== null
  );
}

@Injectable()
export class SwaggerSyncService {
  private readonly logger = new Logger(SwaggerSyncService.name);
  private isSyncing = false;

  constructor(
    @Inject(SWAGGER_SYNC_OPTIONS)
    private readonly config: SwaggerSyncConfig,
    private readonly apiTestService: ApiTestService,
  ) {
    if (!SwaggerSyncService.isValidBaseUrl(this.config.baseUrl)) {
      throw new Error(`Invalid base URL: ${this.config.baseUrl}`);
    }
    const apiKey = this.config.apiKey ?? '';
    if (apiKey.length > 0) {
      this.logger.log('Postman API key detected, collection will sync to Postman.');
    } else if (!this.config.dryRun) {
      this.logger.warn('No Postman API key (apiKey is empty). Upload will be skipped.');
    }
  }

  private static isValidBaseUrl(baseUrl: string): boolean {
    try {
      return new URL(baseUrl).hostname.length > 0;
    } catch {
      return false;
    }
  }

  private async uploadToPostman(collection: PostmanCollection): Promise<boolean> {
    if (this.config.dryRun) {
      this.logger.log('[dryRun] Skipping upload to Postman.');
      return false;
    }
    if (this.config.apiKey.length === 0) {
      this.logger.warn('No Postman API key provided (apiKey is empty). Skipping upload.');
      return false;
    }
    this.logger.log('Uploading collection to Postman...');

    let summaries: PostmanCollectionSummary[];
    try {
      const collectionsResponse = await axios.get('https://api.getpostman.com/collections', {
        headers: { 'X-Api-Key': this.config.apiKey },
        validateStatus: () => true,
      });
      if (collectionsResponse.status === 401 || collectionsResponse.status === 403) {
        this.logger.error(
          `Postman API authentication failed (HTTP ${collectionsResponse.status}). Check your Postman API key and network access.`,
        );
        return false;
      }
      if (collectionsResponse.status < 200 || collectionsResponse.status >= 300) {
        this.logger.error(
          `Failed to fetch Postman collections: HTTP ${collectionsResponse.status}.`,
        );
        return false;
      }

      const collections: unknown =
        typeof collectionsResponse.data === 'object' &&
        collectionsResponse.data !== null &&
        'collections' in collectionsResponse.data
          ? collectionsResponse.data.collections
          : undefined;
      summaries = Array.isArray(collections) ? collections.filter(isPostmanCollectionSummary) : [];
    } catch (error) {
      this.logger.error(
        `Failed to fetch Postman collections: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }

    const existingCollection = summaries.find((entry) => entry.name === collection.info.name);

    try {
      if (existingCollection) {
        this.logger.log(
          `Updating existing collection: ${collection.info.name} - ${existingCollection.uid}`,
        );
        const duration = await SwaggerSyncService.sendCollection(
          'put',
          `https://api.getpostman.com/collections/${existingCollection.uid}`,
          this.config.apiKey,
          collection,
        );
        this.logger.log(
          `Collection updated on Postman: ${collection.info.name} (${existingCollection.uid}), duration: ${duration}s`,
        );
        return true;
      }

      this.logger.log('Creating new collection on Postman...');
      const duration = await SwaggerSyncService.sendCollection(
        'post',
        'https://api.getpostman.com/collections',
        this.config.apiKey,
        collection,
      );
      this.logger.log(
        `Collection created on Postman: ${collection.info.name}, duration: ${duration}s`,
      );
      return true;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`Postman API Error: ${error.code}`);
        return false;
      }
      this.logger.error(
        `Collection upload failed, check your Postman API key and network: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  private static async sendCollection(
    method: 'put' | 'post',
    url: string,
    apiKey: string,
    collection: PostmanCollection,
  ): Promise<string> {
    const start = process.hrtime.bigint();
    const response = await axios({
      method,
      url,
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      data: {
        collection,
      },
      validateStatus: () => true,
    });
    const duration = (Number(process.hrtime.bigint() - start) / 1e9).toFixed(2);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Postman API returned HTTP ${response.status} for ${method.toUpperCase()} ${url}`,
      );
    }
    return duration;
  }

  private static swaggerCandidates(baseUrl: string, swaggerPath: string): string[] {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const cleanPath = swaggerPath.replace(/^\/+|\/+$/g, '');
    const candidates = [`${cleanBase}/${cleanPath}-json`, `${cleanBase}/${cleanPath}/json`];
    return [...new Set(candidates)];
  }

  private async resolveSwaggerDocument(): Promise<SwaggerDocument> {
    const candidates = SwaggerSyncService.swaggerCandidates(
      this.config.baseUrl,
      this.config.swaggerPath,
    );
    const tried: string[] = [];
    for (const url of candidates) {
      tried.push(url);
      const response = await axios.get(url, { validateStatus: () => true });
      if (response.status === 200 && isSwaggerPathsDocument(response.data)) {
        this.logger.log(`Swagger document found at: ${url}`);
        return response.data;
      }
      this.logger.warn(`Candidate ${url} missing required fields.`);
    }
    throw new Error(
      `Unable to fetch Swagger document from ${this.config.baseUrl}. Tried: ${tried.join(', ')}`,
    );
  }

  buildCollection(swagger: SwaggerDocument): PostmanCollection {
    return {
      info: {
        name: this.config.collectionName || swagger.info.title || 'API Collection',
        description: swagger.info.description || '',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      variable: [
        {
          key: 'baseUrl',
          value: this.config.baseUrl,
          type: 'string',
        },
        { key: 'token', value: '', type: 'string' },
      ],
      item: SwaggerSyncService.toCollectionItems(swagger.paths, this.config),
    };
  }

  async previewSync(): Promise<SyncPlan> {
    const swagger = await this.resolveSwaggerDocument();
    const collection = this.buildCollection(swagger);
    const current = this.config.dryRun
      ? undefined
      : await this.fetchCurrentCollection(collection.info.name);
    const diff = diffContracts(
      normalizeSwaggerEndpoints(swagger),
      current ? normalizePostmanEndpoints(current) : [],
    );
    return { collection, ...diff };
  }

  private async fetchCurrentCollection(name: string): Promise<PostmanCollection | undefined> {
    if (this.config.apiKey.length === 0) {
      return undefined;
    }
    const list = await axios.get('https://api.getpostman.com/collections', {
      headers: { 'X-Api-Key': this.config.apiKey },
      validateStatus: () => true,
    });
    if (list.status < 200 || list.status >= 300) {
      throw new Error(`Postman API returned HTTP ${list.status} for GET /collections`);
    }
    const collections: unknown =
      typeof list.data === 'object' && list.data !== null && 'collections' in list.data
        ? list.data.collections
        : undefined;
    const summaries = Array.isArray(collections)
      ? collections.filter(isPostmanCollectionSummary)
      : [];
    const existing = summaries.find((entry) => entry.name === name);
    if (!existing) {
      return undefined;
    }
    const detail = await axios.get(`https://api.getpostman.com/collections/${existing.uid}`, {
      headers: { 'X-Api-Key': this.config.apiKey },
      validateStatus: () => true,
    });
    if (detail.status < 200 || detail.status >= 300) {
      throw new Error(
        `Postman API returned HTTP ${detail.status} for GET /collections/${existing.uid}`,
      );
    }
    if (!isPostmanCollectionResponse(detail.data)) {
      throw new Error(`Postman collection ${existing.uid} has an invalid response`);
    }
    return detail.data.collection;
  }

  async syncSwagger(): Promise<void> {
    if (this.isSyncing) {
      return;
    }

    this.isSyncing = true;

    try {
      this.logger.log('Fetching Swagger documentation...');
      const plan = await this.previewSync();
      if (this.config.runTest ?? true) {
        await this.apiTestService.runTestsInBackground(
          plan.collection,
          this.config.baseUrl,
          this.config.outputMode ?? 'compact',
        );
      }
      const upload = await this.uploadToPostman(plan.collection);
      if (upload) {
        this.logger.log('Collection uploaded successfully.');
      }
    } catch (error) {
      SwaggerSyncService.logSyncError(this.logger, this.config.baseUrl, error);
    } finally {
      this.isSyncing = false;
    }
  }

  // Exact-match exclusion: an entry ignores the Swagger path itself
  // (leading slashes are normalized on both sides), not a prefix.
  // Ignored paths never enter the collection, so the API test runner
  // skips them too because it walks the built collection.
  private static isIgnoredPath(config: SwaggerSyncConfig, path: string): boolean {
    const list = config.ignorePathWithBearerToken;
    if (!Array.isArray(list) || list.length === 0) {
      return false;
    }
    const normalized = path.replace(/^\/+/, '');
    return list.some(
      (entry) => typeof entry === 'string' && entry.replace(/^\/+/, '') === normalized,
    );
  }

  private static toCollectionItems(
    paths: SwaggerDocument['paths'],
    config: SwaggerSyncConfig,
  ): CollectionNode[] {
    const items: CollectionNode[] = [];

    for (const [path, methods] of Object.entries(paths)) {
      if (SwaggerSyncService.isIgnoredPath(config, path)) {
        continue;
      }
      const pathSegments = path.split('/').filter((part) => part.length > 0);
      let currentLevel = items;

      pathSegments.forEach((segment, index) => {
        const isLastSegment = index === pathSegments.length - 1;
        let folder: PostmanFolder | undefined = currentLevel.find(
          (item): item is PostmanFolder => 'item' in item && item.name === segment,
        );

        if (!folder) {
          folder = { name: segment, item: [] };
          currentLevel.push(folder);
        }

        if (isLastSegment) {
          for (const [method, details] of Object.entries(methods)) {
            folder.item.push({
              name: details.summary || `${segment} ${method.toUpperCase()}`,
              request: {
                method: method.toUpperCase(),
                header: [
                  { key: 'Accept', value: 'application/json' },
                  { key: 'Authorization', value: 'Bearer {{token}}' },
                ],
                url: {
                  raw: `{{baseUrl}}${path}`,
                  host: ['{{baseUrl}}'],
                  path: pathSegments,
                },
              },
              response: [],
            });
          }
        }

        currentLevel = folder.item;
      });
    }

    return items;
  }

  private static logSyncError(logger: Logger, baseUrl: string, error: unknown): void {
    let errors: unknown[] = [];
    if (
      typeof error === 'object' &&
      error !== null &&
      'errors' in error &&
      Array.isArray(error.errors)
    ) {
      errors = error.errors;
    }
    const isConnectionRefused = errors.some((entry) => {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        !('code' in entry) ||
        entry.code !== 'ECONNREFUSED' ||
        !('address' in entry)
      ) {
        return false;
      }
      return entry.address === '::1' || entry.address === '127.0.0.1';
    });

    if (isConnectionRefused) {
      logger.error(`Please make sure that the API server is running on ${baseUrl}.`);
    } else {
      logger.error(`Unexpected error: ${String(error)}`);
    }
  }
}
