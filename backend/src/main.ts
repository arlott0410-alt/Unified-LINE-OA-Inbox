import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
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
  const fastify = adapter.getInstance();

  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(body as string, 'utf8');
    (req as unknown as { rawBody?: Buffer }).rawBody = buf;
    try {
      done(null, JSON.parse(buf.toString('utf8')));
    } catch {
      done(null, {});
    }
  });

  // Cookie must be registered before session. @fastify/session expects a plugin named 'fastify-cookie';
  // @fastify/cookie registers under a different name, so wrap it with that name.
  await fastify.register(
    async (instance) => {
      await instance.register(cookie);
    },
    { name: 'fastify-cookie' },
  );
  await fastify.register(session, {
    secret,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 86400 * 7,
    },
    saveUninitialized: false,
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.enableCors({ origin: process.env.FRONTEND_URL ?? '*', credentials: true });

  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`Listening on 0.0.0.0:${port}`);
}

bootstrap();
