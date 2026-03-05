import { Controller, Get, UseGuards } from '@nestjs/common';
import { InboxService } from './inbox.service';
import { SessionOrBearerGuard } from '../auth/session-or-bearer.guard';
import { Req } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

@Controller('api/inbox')
@UseGuards(SessionOrBearerGuard)
export class InboxController {
  constructor(
    private inbox: InboxService,
    private auth: AuthService,
  ) {}

  @Get()
  async list(
    @Req() req: { user: { id: string; role: string } },
  ) {
    const isAdmin = this.auth.isAdmin(req.user.role);
    return this.inbox.getThreadsForAgent(req.user.id, isAdmin);
  }
}
