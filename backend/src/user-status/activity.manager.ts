import { Injectable } from '@nestjs/common';

import { Activity, UserId } from '../util/type';

@Injectable()
export class ActivityManager {
  private userAcitivity: Map<UserId, Activity> = new Map();

  getActivity(userId: UserId) {
    return this.userAcitivity.get(userId) ?? null;
  }

  setActivity(userId: UserId, activity: Activity) {
    this.userAcitivity.set(userId, activity);
  }

  deleteActivity(userId: UserId) {
    this.userAcitivity.delete(userId);
  }
}
