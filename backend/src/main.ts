import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
      if (config.ramLimit && /^\d+$/.test(String(config.ramLimit))) {
        process.env.NODE_OPTIONS = `--max-old-space-size=${parseInt(String(config.ramLimit), 10)}`;
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
    // Database may not be ready during initial bootstrap
  } finally {
    await prisma.$disconnect();
  }

  const app = await NestFactory.create(AppModule, {
    logger: winstonLogger,
  });

  app.enableShutdownHooks();

  // Security & Body Parsing
  const expressInstance = app.getHttpAdapter().getInstance();
  expressInstance.set('trust proxy', 1);
  
  app.use(helmet());

  // CORS Configuration
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:3000'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  
  // Body parser with reasonable limit
  const express = require('express');
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Global Interceptors & Filters
  const auditContextService = app.get(AuditContextService);
  const configService = app.get(ConfigService);
  app.useGlobalInterceptors(new LoggingInterceptor(), new AuditInterceptor(auditContextService));
  app.useGlobalFilters(new HttpExceptionFilter(configService));

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger Documentation - only in non-production
  if (process.env.NODE_ENV !== 'production') {
    const { SwaggerModule, DocumentBuilder } = require('@nestjs/swagger');
    const config = new DocumentBuilder()
      .setTitle('YATO API')
      .setDescription('Infrastructure Platform Management API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
    logger.log(`Swagger documentation: http://localhost:${process.env.PORT || 3000}/docs`);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
