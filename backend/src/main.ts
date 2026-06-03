import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { winstonLogger } from './common/logger/winston.config';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AuditContextService } from './common/context/audit-context.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Load tuning configurations from Database to override process.env early
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'TUNING_CONFIG' } });
    if (setting && setting.value) {
      const config = setting.value as any;
      if (config.ramLimit) {
        process.env.NODE_OPTIONS = `--max-old-space-size=${config.ramLimit}`;
      }
      if (config.notificationConcurrency) {
        process.env.NOTIFICATION_CONCURRENCY = String(config.notificationConcurrency);
      }
      if (config.cacheTtlSeconds) {
        process.env.CACHE_TTL_SECONDS = String(config.cacheTtlSeconds);
      }
      logger.log(`Tuning configurations loaded from database: ${JSON.stringify(config)}`);
    }
  } catch (e) {
    // Database may not be ready, migrated, or connected yet during initial bootstrap. Ignore.
  } finally {
    await prisma.$disconnect();
  }

  const app = await NestFactory.create(AppModule, {
    logger: winstonLogger,
  });

  // Enable Graceful Shutdown for Background Workers and Queues
  app.enableShutdownHooks();

  // Security & Body Parsing
  const expressInstance = app.getHttpAdapter().getInstance();
  expressInstance.set('trust proxy', true);
  
  app.use(helmet());
  app.enableCors();
  
  // Increase payload limit for base64 images
  const express = require('express');
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Global Interceptors & Filters
  const auditContextService = app.get(AuditContextService);
  app.useGlobalInterceptors(new LoggingInterceptor(), new AuditInterceptor(auditContextService));
  app.useGlobalFilters(new HttpExceptionFilter());

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('YATO API')
    .setDescription('Infrastructure Platform Management API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Swagger documentation: http://localhost:${port}/docs`);
}
bootstrap();
