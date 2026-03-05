import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LocalStrategy } from './local.strategy';
import { SessionSerializer } from './session.serializer';
import { SessionMiddleware } from './session.middleware';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [PassportModule.register({ session: false }), RealtimeModule],
  providers: [AuthService, LocalStrategy, SessionSerializer, SessionMiddleware, AdminGuard],
  controllers: [AuthController],
  exports: [AuthService, AdminGuard],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SessionMiddleware).forRoutes('*');
  }
}
