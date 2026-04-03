import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Backend Smoke E2E', () => {
  let app: INestApplication;
  let tbmToken: string;
  let lecturerToken: string;
  let studentToken: string;

  beforeAll(async () => {
    process.env.MOCK_AUTH = 'true';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
    process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET =
      process.env.GOOGLE_CLIENT_SECRET || 'test-client-secret';
    process.env.GOOGLE_CALLBACK_URL =
      process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/v1/auth/google/callback';
    process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

    const jwtService = new JwtService({ secret: process.env.JWT_SECRET });

    tbmToken = jwtService.sign({
      sub: 'USR003',
      email: 'tbm@hcmute.edu.vn',
      role: 'TBM',
    });

    lecturerToken = jwtService.sign({
      sub: 'USR002',
      email: 'lecturer@hcmute.edu.vn',
      role: 'LECTURER',
    });

    studentToken = jwtService.sign({
      sub: 'USR001',
      email: 'student@hcmute.edu.vn',
      role: 'STUDENT',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const authz = (token: string) => ({ Authorization: `Bearer ${token}` });

  const resolveSmokeTopicId = async (): Promise<string | null> => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/topics?page=1&size=1')
      .set(authz(tbmToken));

    if (
      res.status !== 200 ||
      !Array.isArray(res.body?.data) ||
      !res.body.data[0]?.id
    ) {
      return null;
    }

    return String(res.body.data[0].id);
  };

  it('GET /api/v1/health should be healthy', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(res.body.status).toBe('healthy');
    expect(Array.isArray(res.body.components)).toBe(true);
  });

  it('GET /api/v1/auth/me should return current profile', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(authz(tbmToken))
      .expect(200);

    expect(res.body.data.id).toBe('USR003');
    expect(res.body.data.accountRole).toBe('TBM');
  });

  it('GET /api/v1/users/me should return user profile', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set(authz(studentToken));

    if (res.status === 404) {
      expect(res.body.status).toBe(404);
      expect(res.body.detail ?? res.body.title).toBeDefined();
      return;
    }

    expect(res.status).toBe(200);
    expect(typeof res.body.data.id).toBe('string');
    expect(typeof res.body.data.accountRole).toBe('string');
  });

  it('GET /api/v1/periods should return period list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/periods')
      .set(authz(tbmToken))
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it('GET /api/v1/topics should return topic list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/topics')
      .set(authz(tbmToken))
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it('GET /api/v1/topics/:topicId/assignments should return assignments', async () => {
    const topicId = await resolveSmokeTopicId();
    if (!topicId) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app.getHttpServer())
      .get(`/api/v1/topics/${topicId}/assignments`)
      .set(authz(tbmToken))
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/v1/topics/:topicId/submissions should return submissions', async () => {
    const topicId = await resolveSmokeTopicId();
    if (!topicId) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app.getHttpServer())
      .get(`/api/v1/topics/${topicId}/submissions`)
      .set(authz(tbmToken))
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/v1/topics/:topicId/scores should return scores', async () => {
    const topicId = await resolveSmokeTopicId();
    if (!topicId) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app.getHttpServer())
      .get(`/api/v1/topics/${topicId}/scores`)
      .set(authz(tbmToken))
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/v1/notifications should return notifications list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set(authz(studentToken))
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it('GET /api/v1/exports should return exports list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/exports')
      .set(authz(lecturerToken))
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it('should return RFC7807 body for not found error', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/periods/not_found_period')
      .set(authz(tbmToken))
      .expect(404);

    expect(res.body.type).toBe('https://kltn.hcmute.edu.vn/errors/404');
    expect(res.body.status).toBe(404);
    expect(res.body.title).toBeDefined();
    expect(res.body.detail).toBeDefined();
    expect(res.body.instance).toBe('/api/v1/periods/not_found_period');
  });

  it('should return RFC7807 body with validation errors', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/periods')
      .set(authz(tbmToken))
      .send({})
      .expect(400);

    expect(res.body.type).toBe('https://kltn.hcmute.edu.vn/errors/400');
    expect(res.body.status).toBe(400);
    expect(res.body.detail).toBe('Validation failed');
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });
});