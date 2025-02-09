import { Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SwaggerSyncConfig } from './interfaces/swagger-sync-config.interface';
import { SWAGGER_SYNC_OPTIONS } from './constants/constants';
import { ApiTestService } from './api-test.service';

@Injectable()
export class SwaggerSyncService {
  private readonly logger = new Logger(SwaggerSyncService.name);
  private isSyncing = false;

  constructor(
    @Inject(SWAGGER_SYNC_OPTIONS)
    private readonly config: SwaggerSyncConfig,
    private readonly apiTestService: ApiTestService,
  ) {
    this.validateBaseUrl(this.config.baseUrl);
  }

  private validateBaseUrl(baseUrl: string): void {
    try {
      const url = new URL(baseUrl);
      if (!url.hostname) {
        throw new Error('Invalid base URL');
      }
    } catch (error) {
      throw new Error(`Invalid base URL: ${baseUrl}`);
    }
  }

  private async uploadToPostman(collection: any): Promise<boolean> {
    this.logger.log('Uploading collection to Postman...');
    try {
      const collectionsResponse = await axios.get(
        'https://api.getpostman.com/collections',
        {
          headers: { 'X-Api-Key': this.config.apiKey },
        },
      );

      const existingCollection = collectionsResponse.data.collections.find(
        (col: any) => col.name === collection.info.name,
      );

      if (existingCollection) {
        this.logger.log(
          `Updating existing collection: ${collection.info.name} - ${existingCollection.uid}`,
        );
        const start = process.hrtime.bigint();
        await axios({
          method: 'put',
          url: `https://api.getpostman.com/collections/${existingCollection.uid}`,
          headers: {
            'X-Api-Key': this.config.apiKey,
            'Content-Type': 'application/json',
          },
          data: {
            collection,
          },
        });
        const end = process.hrtime.bigint();
        const timeInSeconds = (Number(end - start) / 1000000000).toFixed(2);

        this.logger.log(
          `Collection ${collection.info.name} - ${existingCollection.uid} processed successfully!, duration: ${timeInSeconds}s`,
        );

        return true;
      } else {
        // Create new collection
        this.logger.log('Creating new collection...');
        const start = process.hrtime.bigint();
        await axios({
          method: 'post',
          url: 'https://api.getpostman.com/collections',
          headers: {
            'X-Api-Key': this.config.apiKey,
            'Content-Type': 'application/json',
          },
          data: {
            collection,
          },
        });
        const end = process.hrtime.bigint();
        const timeInSeconds = (Number(end - start) / 1000000000).toFixed(2);

        this.logger.log(
          `Collection ${collection.info.name} processed successfully!, duration: ${timeInSeconds}s`,
        );

        return true;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`Postman API Error: ${error.code}`);
        return false;
      }
    }
  }

  async syncSwagger(): Promise<void> {
    if (this.isSyncing) {
      return;
    }

    this.isSyncing = true;

    try {
      this.logger.log('Fetching Swagger documentation...');
      const swaggerUrl = `${this.config.baseUrl}/${this.config.swaggerPath}-json`;
      const response = await axios.get(swaggerUrl);
      const swaggerJson = response.data;

      const postmanCollection = {
        info: {
          name:
            this.config.collectionName ||
            swaggerJson.info.title ||
            'API Collection',
          description: swaggerJson.info.description || '',
          schema:
            'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        variable: [
          {
            key: 'baseUrl',
            value: this.config.baseUrl,
            type: 'string',
          },
          { key: 'token', value: '', type: 'string' },
        ],
        item: Object.entries(swaggerJson.paths).reduce(
          (acc: any[], [path, methods]) => {
            const pathSegments = path.split('/').filter((p) => p);
            let currentLevel = acc;

            pathSegments.forEach((segment, index) => {
              const isLastSegment = index === pathSegments.length - 1;
              let folder = currentLevel.find((item) => item.name === segment);

              if (!folder) {
                folder = { name: segment, item: [] };
                currentLevel.push(folder);
              }

              if (isLastSegment) {
                folder.item.push(
                  ...Object.entries(methods).map(
                    ([method, details]: [string, any]) => ({
                      name:
                        details.summary || `${segment} ${method.toUpperCase()}`,
                      request: {
                        method: method.toUpperCase(),
                        header: [
                          { key: 'Accept', value: 'application/json' },
                          ...(this.config.ignorePathWithBearerToken?.length > 1
                            ? this.config.ignorePathWithBearerToken.includes(
                                path,
                              )
                              ? []
                              : [
                                  {
                                    key: 'Authorization',
                                    value: 'Bearer {{token}}',
                                  },
                                ]
                            : []),
                        ],
                        url: {
                          raw: `{{baseUrl}}${path}`,
                          host: ['{{baseUrl}}'],
                          path: pathSegments,
                        },
                      },
                      response: [],
                    }),
                  ),
                );
              }
              currentLevel = folder.item;
            });
            return acc;
          },
          [],
        ),
      };

      // Run tests in parallel with API
      const runTests = this.config.runTest ?? true;
      if (runTests) {
        await this.apiTestService.runTestsInBackground(
          postmanCollection,
          this.config.baseUrl,
        );
      }

      // Upload to Postman after tests are finished
      const upload = await this.uploadToPostman(postmanCollection);
      if (upload) {
        this.logger.log('Collection uploaded successfully 🚀');
      }
    } catch (error) {
      this.handleError(error);
    } finally {
      this.isSyncing = false;
    }
  }

  private handleError(error: any): void {
    const errors = error.errors || [];
    const isConnectionRefused = errors.some(
      (err) =>
        err.code === 'ECONNREFUSED' &&
        (err.address === '::1' || err.address === '127.0.0.1'),
    );

    if (isConnectionRefused) {
      this.logger.error(
        `Please make sure that the API server is running on ${this.config.baseUrl}.`,
      );
    } else {
      this.logger.error(`Unexpected error: ${error}`);
    }
  }
}
