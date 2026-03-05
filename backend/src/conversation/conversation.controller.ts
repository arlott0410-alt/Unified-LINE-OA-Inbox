import { Body, Controller, Param, Post, Get, UseGuards } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { SessionGuard } from '../auth/session.guard';
import { AdminGuard } from '../auth/admin.guard';
import { Req } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

@Controller('api/conversations')
@UseGuards(SessionGuard)
export class ConversationController {
  constructor(
    private conversation: ConversationService,
    private auth: AuthService,
  ) {}

  @Get(':id')
  async get(
    @Param('id') id: string,
    @Req() req: { user: { id: string; role: string } },
  ) {
    const isAdmin = this.auth.isAdmin(req.user.role);
    return this.conversation.getOne(id, req.user.id, isAdmin);
  }

  @Post(':id/reply')
  async reply(
    @Param('id') id: string,
    @Body() body: { text: string },
    @Req() req: { user: { id: string; role: string } },
  ) {
    const isAdmin = this.auth.isAdmin(req.user.role);
    return this.conversation.reply(id, req.user.id, isAdmin, body?.text ?? '');
  }

  @Post(':id/assign')
  @UseGuards(AdminGuard)
  async assign(
    @Param('id') id: string,
    @Body() body: { assignedAgentId: string },
    @Req() req: { user: { id: string } },
  ) {
    return this.conversation.assign(id, body.assignedAgentId, req.user.id);
  }

  @Post(':id/close')
  async close(
    @Param('id') id: string,
    @Req() req: { user: { id: string; role: string } },
  ) {
    const isAdmin = this.auth.isAdmin(req.user.role);
    return this.conversation.close(id, req.user.id, isAdmin);
  }
}
