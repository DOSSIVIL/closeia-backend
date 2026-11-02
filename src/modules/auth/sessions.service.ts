import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import { AuthSession } from './entities/auth-session.entity';

interface NewSession {
  id: string;
  userId: string;
  client: string;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(@InjectRepository(AuthSession) private readonly sessions: Repository<AuthSession>) {}

  async create(input: NewSession): Promise<void> {
    await this.sessions.insert({
      id: input.id,
      userId: input.userId,
      client: input.client,
      expiresAt: input.expiresAt,
      userAgent: input.userAgent?.slice(0, 255) ?? null,
      ip: input.ip?.slice(0, 64) ?? null,
    });
    void this.purgeExpired();
  }

  /** La session existe, appartient à l'utilisateur, n'est ni révoquée ni expirée. */
  async isActive(sessionId: string, userId: string): Promise<boolean> {
    const count = await this.sessions.count({
      where: { id: sessionId, userId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
    });
    return count > 0;
  }

  async revoke(sessionId: string, userId: string, reason: string): Promise<void> {
    await this.sessions.update(
      { id: sessionId, userId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );
  }

  async revokeAll(userId: string, reason: string): Promise<void> {
    await this.sessions.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );
  }

  /** Nettoyage opportuniste : supprime les sessions expirées depuis plus de 7 jours. */
  private async purgeExpired(): Promise<void> {
    try {
      await this.sessions.delete({ expiresAt: LessThan(new Date(Date.now() - 7 * 24 * 3600 * 1000)) });
    } catch (err) {
      this.logger.warn(`Nettoyage des sessions impossible : ${err instanceof Error ? err.message : err}`);
    }
  }
}