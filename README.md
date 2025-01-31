# NestJS Swagger Sync

A NestJS module that automatically synchronizes your Swagger/OpenAPI documentation with Postman collections. This module provides seamless integration between your API documentation and Postman, making it easier to maintain up-to-date API collections.

## Features

- 🔄 Automatic synchronization of Swagger/OpenAPI docs to Postman collections
- 🧪 Optional Newman test running before synchronization
- 🔍 Automatic detection and updating of existing collections
- 📁 Hierarchical organization of API endpoints
- 🔐 Environment variable support for baseUrl and authentication
- 📝 Detailed logging of the sync process
- ⚡ Support for all NestJS versions (6.x and above)

## Prerequisites

Before you begin, ensure you have:

- Node.js (>= 12.0.0)
- NestJS (>= 6.0.0)
- A Postman account and API key
- Swagger/OpenAPI documentation set up in your NestJS application

## Installation

- **NPM**

```bash
npm install nestjs-swagger-sync
```

- **YARN**

```bash
yarn add nestjs-swagger-sync
```

## Quick Start

1. Import the module in your `app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { SwaggerSyncModule } from 'nestjs-swagger-sync';

@Module({
  imports: [
    SwaggerSyncModule.register({
      apiKey: 'your-postman-api-key',
      port: 3000,
      baseUrl: 'http://localhost:3000',
      collectionName: 'My API Collection',
      runTests: true,
      ignoreVariablesPathWithBearerToken: ['api/auth/login']
    }),
  ],
})
export class AppModule {}
```

2. Use the service in your controller or service:

```typescript
import { Controller, Post } from '@nestjs/common';
import { SwaggerSyncService } from 'nestjs-swagger-sync';

@Controller()
export class AppController {
  constructor(private readonly swaggerSyncService: SwaggerSyncService) {}

  @Post('sync')
  async syncSwagger() {
    await this.swaggerSyncService.syncSwagger();
    return { message: 'Swagger documentation synced with Postman' };
  }
}
```

## Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| apiKey | string | Yes | - | Your Postman API key |
| port | number | No | 3000 | The port your API is running on |
| baseUrl | string | No | `http://localhost:{port}` | The base URL of your API |
| collectionName | string | No | API Collection | Name for your Postman collection |
| runTests | boolean | No | false | Whether to run Newman tests before uploading |
| ignoreVariablesPathWithBearerToken | array | No | [] | Array of paths to ignore when adding a Bearer token to the request |

## Postman API Key

To get your Postman API key:

1. Log in to [Postman](https://www.postman.com)
2. Go to your workspace settings
3. Navigate to the "API Keys" section
4. Create a new API key with appropriate permissions

## Environment Variables

The module supports the following environment variables:

```env
POSTMAN_API_KEY=your-api-key
API_PORT=3000
API_BASE_URL=http://localhost:3000
```

## Usage Examples

### Basic Usage

```typescript
SwaggerSyncModule.register({
  apiKey: process.env.POSTMAN_API_KEY,
})
```

### With Custom Configuration

```typescript
SwaggerSyncModule.register({
  apiKey: process.env.POSTMAN_API_KEY,
  port: 4000,
  baseUrl: 'https://api.myapp.com',
  collectionName: 'Production API',
  runTests: true,
})
```

### Manual Sync Trigger

```typescript
@Injectable()
export class YourService {
  constructor(private readonly swaggerSyncService: SwaggerSyncService) {}

  async updatePostmanCollection() {
    try {
      await this.swaggerSyncService.syncSwagger();
      console.log('Postman collection updated successfully');
    } catch (error) {
      console.error('Failed to update Postman collection:', error);
    }
  }
}
```

## Authentication Handling

The module automatically adds authentication headers to requests:

- Excludes auth headers with `ignoreVariablesPathWithBearerToken`
- Adds `Bearer {{token}}` auth header for all other endpoints
- Supports environment variables for flexible token management

## Error Handling

The module provides detailed error messages for common issues:

- Invalid Postman API key
- API server not running
- Network connectivity issues
- Invalid Swagger documentation format

## Compatibility

This package is compatible with:

- NestJS versions 6.x and above
- Node.js version 12 and above
- TypeScript 4.x and above

Tested with:

- NestJS 6.x
- NestJS 7.x
- NestJS 8.x
- NestJS 9.x
- NestJS 10.x

## Contributing

We welcome contributions! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:cov

# Run tests in watch mode
npm run test:watch
```

## Building

```bash
# Build the package
npm run build

# Format code
npm run format

# Lint code
npm run lint
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please:

1. Check the [GitHub Issues](https://github.com/yourusername/nestjs-swagger-sync/issues) page
2. Create a new issue if your problem isn't already listed
3. Contact the maintainers

## Acknowledgments

- NestJS team for the amazing framework
- Postman team for their API platform
- All contributors who help improve this package

## Author

- [Garseta Yusuf](https://github.com/garsetayusuf)

## Changelog

### 1.0.0

- Initial release
- Basic Swagger to Postman sync functionality
- Newman test integration
- Support for all NestJS versions
