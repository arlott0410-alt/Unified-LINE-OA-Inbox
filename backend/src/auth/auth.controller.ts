import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { SessionOrBearerGuard } from './session-or-bearer.guard';
import { SocketTokenService } from '../realtime/socket-token.service';

@Controller('api/auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private jwt: JwtService,
    private socketToken: SocketTokenService,
  ) {}

  @Post('login')
  @UseGuards(AuthGuard('local'))
  async login(
    @Req() req: {
      user: { id: string; name: string; role: string };
      session: { userId?: string };
    },
  ) {
    req.session.userId = req.user.id;
    const accessToken = this.jwt.sign({ sub: req.user.id });
    return { ok: true, user: req.user, accessToken };
  }

  @Post('logout')
  @UseGuards(SessionOrBearerGuard)
  async logout(@Req() req: { session?: { destroy?: (cb: (err?: Error) => void) => void } }) {
    if (req.session?.destroy) {
      return new Promise<void>((resolve, reject) => {
        req.session!.destroy!((err) => (err ? reject(err) : resolve()));
      });
    }
  }

  @Get('me')
  @UseGuards(SessionOrBearerGuard)
  me(@Req() req: { user: { id: string; name: string; role: string } }) {
    return req.user;
  }

  @Get('socket-token')
  @UseGuards(SessionOrBearerGuard)
  getSocketToken(@Req() req: { user: { id: string } }) {
    return { token: this.socketToken.generate(req.user.id) };
  }
}

