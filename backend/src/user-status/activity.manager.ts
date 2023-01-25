import { Injectable } from '@nestjs/common';

import { CurrentUi, UserId } from '../util/type';

@Injectable()
export class ActivityManager {
  private userActivity: Map<UserId, CurrentUi> = new Map();

  getActivity(userId: UserId) {
    return this.userActivity.get(userId) ?? null;
  }

  setActivity(userId: UserId, activity: CurrentUi) {
    this.userActivity.set(userId, activity);
  }

  deleteActivity(userId: UserId) {
    this.userActivity.delete(userId);
  }
}
