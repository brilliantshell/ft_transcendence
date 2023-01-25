import { Test, TestingModule } from '@nestjs/testing';

import { ActivityGateway } from './activity.gateway';
import { ActivityManager } from './activity.manager';

describe('ActivityGateway', () => {
  let gateway: ActivityGateway;
  let manager: ActivityManager;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ActivityGateway, ActivityManager],
    }).compile();
    gateway = module.get<ActivityGateway>(ActivityGateway);
    manager = module.get<ActivityManager>(ActivityManager);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it("should update user's activity", () => {
    gateway.handleCurrentUi({ userId: 1, ui: 'profile' });
    expect(manager.getActivity(1)).toEqual('profile');
  });

  it("should not update user's activity since userId is invalid", () => {
    gateway.handleCurrentUi({ userId: 'yongjule' as any, ui: 'profile' });
    expect(manager.getActivity('yongjule' as any)).toBeFalsy();
  });
});
