import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Notification, NotificationKind } from './entities/notification.entity';

const MAX_NOTIFICATIONS = 50;

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
  ) {}

  async listForUser(userId: string) {
    const [items, unreadCount] = await Promise.all([
      this.notifications.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: MAX_NOTIFICATIONS,
      }),
      this.notifications.count({ where: { userId, read: false } }),
    ]);

    return {
      data: items.map((item) => this.toView(item)),
      unreadCount,
    };
  }

  async createForUser(
    userId: string,
    input: {
      kind: NotificationKind;
      title: string;
      message: string;
    },
    manager?: EntityManager,
  ): Promise<Notification> {
    const repository = manager
      ? manager.getRepository(Notification)
      : this.notifications;
    return repository.save(
      repository.create({
        userId,
        kind: input.kind,
        title: input.title,
        message: input.message,
      }),
    );
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const notification = await this.notifications.findOneBy({
      id: notificationId,
      userId,
    });
    if (!notification) {
      throw new NotFoundException('Notification introuvable.');
    }
    if (!notification.read) {
      await this.notifications.update(
        { id: notificationId, userId },
        { read: true },
      );
    }
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notifications.update({ userId, read: false }, { read: true });
  }

  async clearForUser(userId: string): Promise<void> {
    await this.notifications.delete({ userId });
  }

  private toView(notification: Notification) {
    return {
      id: notification.id,
      kind: notification.kind,
      title: notification.title,
      message: notification.message,
      createdAt: notification.createdAt,
      read: notification.read,
    };
  }
}
