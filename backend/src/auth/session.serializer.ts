import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(private auth: AuthService) {
    super();
  }

  serializeUser(user: { id: string; name: string; role: string }, done: (err: Error | null, payload: string) => void) {
    done(null, user.id);
  }

  async deserializeUser(id: string, done: (err: Error | null, user: unknown) => void) {
    try {
      const user = await this.auth.getAgentById(id);
      done(null, user ?? null);
    } catch (e) {
      done(e as Error, null);
    }
  }
}
