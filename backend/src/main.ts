import { Readable } from 'stream';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import { AppModule } from './app.module';

async function bootstrap() {
  const sessionSecret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === 'production' && !sessionSecret) {
    throw new Error('SESSION_SECRET must be set in production');
  }
  const secret = sessionSecret ?? 'change-me-in-production';

  const adapter = new FastifyAdapter();
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);

  const fastify = app.getHttpAdapter().getInstance();
  // Capture raw body for LINE webhook signature verification only; do not add a second 'application/json' parser
  // (Nest registers its own during init(), so we use preParsing to buffer and attach rawBody for the webhook path).
  fastify.addHook('preParsing', async (request, _reply, payload) => {
    const url = request.url;
    const isJson = request.headers['content-type']?.includes('application/json');
    if (!url.startsWith('/api/webhooks/line') || !isJson) return payload;
    const chunks: Buffer[] = [];
    for await (const chunk of payload) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const buf = Buffer.concat(chunks);
    (request as unknown as { rawBody?: Buffer }).rawBody = buf;
    return Readable.from(buf);
  });

  // Session 7.x expects a plugin named 'fastify-cookie'; wrap @fastify/cookie with fastify-plugin so the name is in metadata.
  await app.register(
    fp(async (instance: FastifyInstance) => {
      await instance.register(cookie);
    }, { name: 'fastify-cookie' }),
  );
  await app.register(session, {
    secret,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 86400 * 7,
    },
    saveUninitialized: false,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.enableCors({ origin: process.env.FRONTEND_URL ?? '*', credentials: true });

  const port = Number(process.env.PORT || 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`Listening on 0.0.0.0:${port}`);
}

bootstrap();
