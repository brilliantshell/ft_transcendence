import { Test, TestingModule } from '@nestjs/testing';

import { ActivityManager } from './activity.manager';
import { Users } from '../entity/users.entity';
import { generateUsers } from '../../test/generate-mock-data';

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
});
