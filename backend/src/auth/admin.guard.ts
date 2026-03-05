import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: { role: string } }>();
    if (!req.user || !this.auth.isAdmin(req.user.role)) throw new ForbiddenException('Admin only');
    return true;
  }
}
