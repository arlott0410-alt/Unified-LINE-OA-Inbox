import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';
import { SocketTokenService } from '../realtime/socket-token.service';

@Controller('api/auth')
export class AuthController {
  constructor(
    private auth: AuthService,
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
    return { ok: true, user: req.user };
  }

  @Post('logout')
  @UseGuards(SessionGuard)
  async logout(@Req() req: { session: { destroy: (cb: (err?: Error) => void) => void } }) {
    return new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => (err ? reject(err) : resolve()));
    });
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() req: { user: { id: string; name: string; role: string } }) {
    return req.user;
  }

  @Get('socket-token')
  @UseGuards(SessionGuard)
  getSocketToken(@Req() req: { user: { id: string } }) {
    return { token: this.socketToken.generate(req.user.id) };
  }
}

