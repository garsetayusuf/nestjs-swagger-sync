export interface SwaggerSyncConfig {
  /**
   * Postman API key
   */
  apiKey: string;
  /**
   * The path to the Swagger documentation. Defaults to `swagger`
   */
  swaggerPath: string;
  /**
   * Base URL of the API.
   */
  baseUrl: string;
  /**
   * Override the Name of swagger to Postman collection. Defaults to swwager Title or `API Collection`
   */
  collectionName?: string;
  /**
   * Whether to run tests or not. Defaults to `true`
   */
  runTest?: boolean;
  /**
   * Array of paths to ignore when adding a Bearer token to the request. Defaults to `[]`
   */
  ignorePathWithBearerToken?: string[];
}
