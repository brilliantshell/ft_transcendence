import { Injectable } from '@nestjs/common';

import { CurrentUi, UserId } from '../util/type';

@Injectable()
export class ActivityManager {
  private readonly userActivity: Map<UserId, CurrentUi> = new Map();
  private readonly watchers: Map<CurrentUi, Map<UserId, Set<UserId>>> =
    new Map();
  private readonly friendWatchers: Map<UserId, Set<UserId>> = new Map();

  getActivity(userId: UserId) {
    return this.userActivity.get(userId) ?? null;
  }

  setActivity(userId: UserId, activity: CurrentUi) {
    this.userActivity.set(userId, activity);
  }

  deleteActivity(userId: UserId) {
    this.userActivity.delete(userId);
  }

  getWatchedUsers(ui: CurrentUi, watcherId: UserId) {
    const watchedMap = this.watchers.get(ui);
    if (watchedMap === undefined) return [];
    const watchedUsers = [];
    for (const [watchedId, watcherSet] of watchedMap) {
      watcherSet.has(watcherId) && watchedUsers.push(watchedId);
    }
    return watchedUsers;
  }

  setWatchingUser(ui: CurrentUi, watchedId: UserId, watcherId: UserId) {
    const watchedMap = this.watchers.get(ui);
    if (watchedMap === undefined) {
      this.watchers.set(ui, new Map([[watchedId, new Set([watcherId])]]));
      return;
    }
    const watcherSet = watchedMap.get(watchedId);
    if (watcherSet === undefined) {
      watchedMap.set(watchedId, new Set([watcherId]));
      return;
    }
    watcherSet.add(watcherId);
  }

  deleteWatchingUser(ui: CurrentUi, watcherId: UserId) {
    const watchedMap = this.watchers.get(ui);
    if (watchedMap === undefined) {
      return;
    }
    for (const [watchedId, watcherSet] of watchedMap) {
      watcherSet.delete(watcherId);
      watcherSet.size === 0 && watchedMap.delete(watchedId);
    }
    watchedMap.size === 0 && this.watchers.delete(ui);
  }

  getFriendWatchedUsers(watcherId: UserId) {
    const watchedUsers = [];
    for (const [watchedId, watcherSet] of this.friendWatchers) {
      watcherSet.has(watcherId) && watchedUsers.push(watchedId);
    }
    return watchedUsers;
  }

  setFriendWatchingUser(watchedId: UserId, watcherId: UserId) {
    const watcherSet = this.friendWatchers.get(watchedId);
    watcherSet === undefined
      ? this.friendWatchers.set(watchedId, new Set([watcherId]))
      : watcherSet.add(watcherId);
  }

  deleteFriendWatchingUser(watcherId: UserId) {
    for (const [watchedId, watcherSet] of this.friendWatchers) {
      watcherSet.delete(watcherId);
      watcherSet.size === 0 && this.friendWatchers.delete(watchedId);
    }
  }
}
