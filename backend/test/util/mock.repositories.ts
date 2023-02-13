import { UserId } from '../src/util/type';

export const mockUsersRepositoryFactory = (entities: any[]) => {
  return {
    find: jest.fn().mockResolvedValue(entities),
    findOne: jest
      .fn()
      .mockImplementation((userId: number) =>
        entities.find((user) => user.userId === userId),
      ),
  };
};

export const mockFriendsRepositoryFactory = (entities: any[]) => {
  return {
    find: jest.fn().mockResolvedValue(entities),
    findBy: jest
      .fn()
      .mockImplementation(
        (options: [{ senderId: UserId }, { receiverId: UserId }]) =>
          entities.filter(
            ({ senderId, receiverId }) =>
              options[0].senderId === senderId ||
              options[1].receiverId === receiverId,
          ),
      ),
  };
};

export const mockBlockedUsersRepositoryFactory = (entities: any[]) => {
  return {
    find: jest.fn().mockResolvedValue(entities),
    findBy: jest
      .fn()
      .mockImplementation(
        (options: [{ blockerId: UserId }, { blockedId: UserId }]) =>
          entities.filter(
            ({ blockerId, blockedId }) =>
              options[0].blockerId === blockerId ||
              options[1].blockedId === blockedId,
          ),
      ),
  };
};
