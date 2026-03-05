import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SessionOrBearerGuard } from '../auth/session-or-bearer.guard';

@Controller('api/agents')
@UseGuards(SessionOrBearerGuard)
export class AgentsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list() {
    return this.prisma.agent.findMany({
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
  }
}
