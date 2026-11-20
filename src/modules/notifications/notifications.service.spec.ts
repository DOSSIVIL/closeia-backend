import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  const repository = {
    count: jest.fn(),
    create: jest.fn((value) => value),
    delete: jest.fn(),
    find: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: repository },
      ],
    }).compile();
    service = module.get(NotificationsService);
  });

  it('returns only the current user notifications and unread count', async () => {
    const createdAt = new Date();
    repository.find.mockResolvedValue([
      {
        id: 'notice-1',
        kind: 'success',
        title: 'Bienvenue',
        message: 'Compte créé',
        createdAt,
        read: false,
      },
    ]);
    repository.count.mockResolvedValue(1);

    const result = await service.listForUser('user-1');

    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' }, take: 50 }),
    );
    expect(repository.count).toHaveBeenCalledWith({
      where: { userId: 'user-1', read: false },
    });
    expect(result).toEqual({
      data: [
        {
          id: 'notice-1',
          kind: 'success',
          title: 'Bienvenue',
          message: 'Compte créé',
          createdAt,
          read: false,
        },
      ],
      unreadCount: 1,
    });
  });

  it('does not allow reading another user notification', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(
      service.markRead('user-1', 'other-user-notice'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('marks all notifications and clears only the current user items', async () => {
    await service.markAllRead('user-1');
    await service.clearForUser('user-1');

    expect(repository.update).toHaveBeenCalledWith(
      { userId: 'user-1', read: false },
      { read: true },
    );
    expect(repository.delete).toHaveBeenCalledWith({ userId: 'user-1' });
  });
});
