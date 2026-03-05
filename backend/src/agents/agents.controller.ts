import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SessionGuard } from '../auth/session.guard';

@Controller('api/agents')
@UseGuards(SessionGuard)
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
