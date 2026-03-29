import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { createAccessLogMiddleware } from './common/middleware/access-log.middleware';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const isAccessLogEnabled = process.env.ACCESS_LOG_ENABLED !== 'false';
  if (isAccessLogEnabled) {
    app.use(createAccessLogMiddleware());
    logger.log('🧾 Access log: enabled');
  }

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new ProblemDetailsFilter());

  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3000',
    'http://localhost:3001',
  ];
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Swagger
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('KLTN Management API')
      .setDescription('HCM-UTE Graduation Management System — API Reference')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'JWT',
      )
      .addTag('auth', 'Authentication — Google OAuth2 + JWT')
      .addTag('users', 'Users management')
      .addTag('periods', 'Enrollment periods (BCTT / KLTN)')
      .addTag('topics', 'Thesis topics workflow')
      .addTag('assignments', 'Role assignments (GVPB, council)')
      .addTag('schedules', 'Defense schedules')
      .addTag('submissions', 'File submissions (PDF upload)')
      .addTag('scores', 'Rubric scoring')
      .addTag('exports', 'DOCX / score sheet exports')
      .addTag('notifications', 'In-app notifications')
      .addTag('audit', 'Audit logs')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/v1/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
    logger.log(`📖 Swagger UI: http://localhost:${process.env.PORT || 3001}/api/v1/docs`);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`🚀 API running on http://localhost:${port}/api/v1`);
  logger.log(`📋 Health check: http://localhost:${port}/api/v1/health`);
}
bootstrap();
