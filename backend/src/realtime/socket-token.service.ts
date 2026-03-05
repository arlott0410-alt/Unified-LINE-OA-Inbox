import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

const SOCKET_TOKEN_MAP = new Map<string, { userId: string; expires: number }>();
const TTL_MS = 60 * 1000;

export function getUserIdFromSocketToken(token: string): string | null {
  const entry = SOCKET_TOKEN_MAP.get(token);
  if (!entry || entry.expires < Date.now()) {
    if (entry) SOCKET_TOKEN_MAP.delete(token);
    return null;
  }
  return entry.userId;
}

@Injectable()
export class SocketTokenService {
  generate(userId: string): string {
    const token = randomBytes(24).toString('hex');
    SOCKET_TOKEN_MAP.set(token, { userId, expires: Date.now() + TTL_MS });
    return token;
  }
}
