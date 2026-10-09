export interface SwaggerSyncConfig {
  /**
   * Postman API key. An empty string skips the upload; fetch, build, and
   * tests still run.
   */
  apiKey: string;
  /**
   * The path to the Swagger documentation. Defaults to `swagger`.
   * The fetch URL is `${baseUrl}/${swaggerPath}-json`, with `-json` and
   * `/json` variants probed as fallback.
   */
  swaggerPath: string;
  /**
   * Base URL of the API.
   */
  baseUrl: string;
  /**
   * Override the Name of swagger to Postman collection. Defaults to swagger Title or `API Collection`
   */
  collectionName?: string;
  /**
   * Whether to run tests or not. Defaults to `true`
   */
  runTest?: boolean;
  /**
   * Array of paths to ignore when adding a Bearer token to the request. Defaults to `[]`.
   * Exact match after leading-slash normalization; ignored paths never
   * enter the collection and are never probed.
   */
  ignorePathWithBearerToken?: string[];
  /**
   * Build the collection and run tests without calling the Postman API.
   * Defaults to `false`.
   */
  dryRun?: boolean;
}
