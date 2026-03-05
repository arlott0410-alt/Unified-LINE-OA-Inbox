import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import { AppModule } from './app.module';

async function bootstrap() {
  const adapter = new FastifyAdapter();
  adapter.getInstance().addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(body as string, 'utf8');
    (req as unknown as { rawBody?: Buffer }).rawBody = buf;
    try {
      done(null, JSON.parse(buf.toString('utf8')));
    } catch {
      done(null, {});
    }
  });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);
  const secret = process.env.SESSION_SECRET ?? 'change-me-in-production';
  await app.register(fastifyCookie);
  await app.register(fastifySession, {
    secret,
    cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 86400 * 7 },
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.enableCors({ origin: process.env.FRONTEND_URL ?? '*', credentials: true });
  const port = parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
