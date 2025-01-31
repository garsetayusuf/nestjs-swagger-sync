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
   * Port to run tests on. Defaults to 3000
   */
  port?: number;
  /**
   * Base URL of the API. Defaults to `http://localhost:$port`
   */
  baseUrl?: string;
  /**
   * Name of the Postman collection to create. Defaults to `My New Collection`
   */
  collectionName?: string;
  /**
   * Whether to run tests or not. Defaults to `true`
   */
  runTests?: boolean;
  /**
   * Array of paths to ignore when adding a Bearer token to the request. Defaults to `[]`
   */
  ignoreVariablesPathWithBearerToken?: string[];
}
