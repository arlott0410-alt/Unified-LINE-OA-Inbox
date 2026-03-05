import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { AgentRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async validateAgent(name: string, password: string) {
    const agent = await this.prisma.agent.findFirst({ where: { name } });
    if (!agent || !(await bcrypt.compare(password, agent.passwordHash))) return null;
    return { id: agent.id, name: agent.name, role: agent.role };
  }

  async getAgentById(id: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id },
      select: { id: true, name: true, role: true },
    });
    return agent;
  }

  isAdmin(role: string): role is AgentRole {
    return role === 'admin';
  }
}
