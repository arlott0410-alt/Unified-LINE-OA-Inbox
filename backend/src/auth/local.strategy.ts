import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private auth: AuthService) {
    super({ usernameField: 'name', passwordField: 'password' });
  }

  async validate(name: string, password: string) {
    const user = await this.auth.validateAgent(name, password);
    if (!user) throw new UnauthorizedException('Invalid name or password');
    return user;
  }
}
