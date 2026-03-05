import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LocalStrategy } from './local.strategy';
import { SessionSerializer } from './session.serializer';
import { SessionMiddleware } from './session.middleware';
import { SessionOrBearerGuard } from './session-or-bearer.guard';
import { AdminGuard } from './admin.guard';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    PassportModule.register({ session: false }),
    JwtModule.register({
      secret: process.env.SESSION_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: '7d' },
    }),
    RealtimeModule,
  ],
  providers: [AuthService, LocalStrategy, SessionSerializer, SessionMiddleware, SessionOrBearerGuard, AdminGuard],
  controllers: [AuthController],
  exports: [AuthService, AdminGuard, SessionOrBearerGuard],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SessionMiddleware).forRoutes('*');
  }
}
