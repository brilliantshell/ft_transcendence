import { Test, TestingModule } from '@nestjs/testing';

import { ActivityManager } from './activity.manager';
import { Users } from '../entity/users.entity';
import { generateUsers } from '../../test/util/generate-mock-data';

describe('ActivityService', () => {
  let manager: ActivityManager;
  let usersEntities: Users[];

  beforeAll(() => {
    usersEntities = generateUsers(100);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ActivityManager],
    }).compile();

    manager = module.get<ActivityManager>(ActivityManager);
  });

  it('should be defined', () => {
    expect(manager).toBeDefined();
  });

  it("should set user's activity", () => {
    const { userId } = usersEntities[0];
    manager.setActivity(userId, 'profile');
    expect(manager.getActivity(userId)).toBe('profile');
  });

  it('should return null if user is not logged in', () => {
    const { userId } = usersEntities[0];
    expect(manager.getActivity(userId)).toBeNull();
  });

  it("should delete a user's activity when the user logs out", () => {
    const { userId } = usersEntities[0];
    manager.setActivity(userId, 'profile');
    manager.deleteActivity(userId);
    expect(manager.getActivity(userId)).toBeNull();
  });

  /*****************************************************************************
   *                                                                           *
   * SECTION : watchedUsers                                                    *
   *                                                                           *
   ****************************************************************************/

  it('should return an empty array if no users are being watched', () => {
    const { userId } = usersEntities[0];
    expect(manager.getWatchedUsers('profile', userId)).toEqual([]);
  });

  it('should return an array of watched users by a user', () => {
    const { userId } = usersEntities[0];

    for (let i = 1; i < 10; i++) {
      manager.setWatchingUser('profile', usersEntities[i].userId, userId);
    }
    expect(manager.getWatchedUsers('profile', userId)).toEqual(
      usersEntities.slice(1, 10).map(({ userId }) => userId),
    );
    // manager.deleteWatchingUser
  });
});
