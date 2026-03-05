import { Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';

declare module 'fastify' {
  interface Session {
    userId?: string;
  }
}

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(private auth: AuthService) {}

  async use(req: FastifyRequest & { session?: { userId?: string }; user?: unknown }, _res: FastifyReply, next: () => void) {
    const sid = req.session?.userId;
    if (sid) {
      try {
        req.user = await this.auth.getAgentById(sid);
      } catch {
        req.user = null;
      }
    }
    next();
  }
}
