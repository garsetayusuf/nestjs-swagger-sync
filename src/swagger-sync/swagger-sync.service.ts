import { Inject, Injectable, Logger } from '@nestjs/common';
import * as newman from 'newman';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { SwaggerSyncConfig } from './interfaces/swagger-sync-config.interface';
import { SWAGGER_SYNC_OPTIONS } from './constants/constants';

@Injectable()
export class SwaggerSyncService {
  private readonly logger = new Logger(SwaggerSyncService.name);

  constructor(
    @Inject(SWAGGER_SYNC_OPTIONS)
    private readonly config: SwaggerSyncConfig,
  ) {}

  private async runNewmanTests(collection: any): Promise<boolean> {
    return new Promise((resolve, reject) => {
      newman.run(
        {
          collection,
          reporters: ['cli'],
          environment: {
            name: 'Local Environment',
            values: [
              {
                key: 'baseUrl',
                value:
                  this.config.baseUrl ||
                  `http://localhost:${this.config.port || 3000}`,
                enabled: true,
              },
            ],
          },
          iterationCount: 1,
          reporter: {
            cli: {
              noSummary: false,
              showTimestamp: true,
            },
          },
        },
        (err, summary) => {
          if (err) {
            this.logger.error('Test API failed:', err);
            reject(err);
            return;
          }

          this.logger.log('Test API completed successfully!');
          if (summary?.run) {
            this.logger.log(
              `Total requests executed: ${summary.run.stats.requests.total}`,
            );
            this.logger.log(
              `Failed requests: ${summary.run.stats.requests.failed}`,
            );
          }
          resolve(true);
        },
      );
    });
  }

  private async uploadToPostman(collection: any): Promise<void> {
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
          `Collection found. Updating existing collection: ${collection.info.name} - ${existingCollection.uid}`,
        );
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
      } else {
        this.logger.log('Collection not found. Creating new collection...');
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
      }
    } catch (error) {
      throw new Error(
        `Postman API Error: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async syncSwagger(): Promise<void> {
    try {
      this.logger.log('Fetching Swagger documentation...');
      const swaggerUrl = `${
        this.config.baseUrl || `http://localhost:${this.config.port || 3000}`
      }/${this.config.swaggerPath}-json`;
      const response = await axios.get(swaggerUrl);
      const swaggerJson = response.data;

      const postmanCollection = {
        info: {
          _postman_id: uuidv4(),
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
            value:
              this.config.baseUrl ||
              `http://localhost:${this.config.port || 3000}`,
            type: 'string',
          },
          { key: 'token', value: '', type: 'string' },
        ],
        item: this.convertSwaggerToPostmanItems(swaggerJson.paths),
      };

      if (this.config.runTests) {
        await this.runNewmanTests(postmanCollection);
      }

      await this.uploadToPostman(postmanCollection);
      this.logger.log('Collection uploaded successfully 🚀');
    } catch (error) {
      this.logger.error(`Error: ${error.message}`);
      throw error;
    }
  }

  private convertSwaggerToPostmanItems(paths: any): any[] {
    return Object.entries(paths).reduce((acc: any[], [path, methods]) => {
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
                name: details.summary || `${segment} ${method.toUpperCase()}`,
                request: {
                  method: method.toUpperCase(),
                  header: [
                    { key: 'Accept', value: 'application/json' },
                    ...(this.config.ignoreVariablesPathWithBearerToken?.length >
                    1
                      ? this.config.ignoreVariablesPathWithBearerToken?.map(
                          (ignorePath) => {
                            return path !== ignorePath
                              ? {
                                  key: 'Authorization',
                                  value: 'Bearer {{token}}',
                                }
                              : null;
                          },
                        )
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
    }, []);
  }
}
