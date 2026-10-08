import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';

export async function createApp() {
  const app = await NestFactory.create(AppModule, new FastifyAdapter(), { logger: false });
  const config = new DocumentBuilder()
    .setTitle('Compatibility API NestJS 7')
    .setDescription('Real compatibility fixture')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http' })
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  return app;
}
