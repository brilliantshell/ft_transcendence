import { Injectable } from '@nestjs/common';

import { CurrentUi, UserId } from '../util/type';

@Injectable()
export class ActivityManager {
  readonly friendListOpenedBy: Set<UserId> = new Set();
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

  /**
   * @description 특정 UI 에서 특정 유저가 보고 있는 유저 컴포넌트들의 유저 ID 반환
   *
   * @param ui 특정 UI
   * @param watcherId 유저 컴포넌트들을 보고 있는 유저의 ID
   * @returns 보여지고 있는 유저들의 ID
   */
  getWatchedUsers(ui: CurrentUi, watcherId: UserId) {
    const watchedMap = this.watchers.get(ui);
    if (watchedMap === undefined) return [];
    const watchedUsers = [];
    for (const [watchedId, watcherSet] of watchedMap) {
      watcherSet.has(watcherId) && watchedUsers.push(watchedId);
    }
    return watchedUsers;
  }

  /**
   * @description 특정 UI 에서 어떤 유저가 특정 유저의 유저 컴포넌트를 보는 경우
   *              보여 지고 있는 유저 컴포넌트의 유저를 보고 있는 유저들 목록에 추가
   *
   * @param ui 특정 UI
   * @param watchedId 보여지고 있는 유저 컴포넌트의 유저 ID
   * @param watcherId 보고 있는 유저의 ID
   */
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

  /**
   * @description 유저가 특정 UI 를 떠날 때, 떠나는 유저를 유저 컴포넌트가 보여 지고 있는
   *              유저들을 보고 있는 유저들 목록에서 삭제
   *
   * @param ui 특정 UI
   * @param watcherId 떠나는 유저의 ID
   */
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

  /**
   * @description 친구 토글 리스트를 보고 있는 유저가 보고 있는 유저 컴포넌트들의 유저 ID 반환
   *
   * @param watcherId 유저 컴포넌트들을 보고 있는 유저의 ID
   * @returns 보여지고 있는 유저들의 ID
   */
  getFriendWatchedUsers(watcherId: UserId) {
    const watchedUsers = [];
    for (const [watchedId, watcherSet] of this.friendWatchers) {
      watcherSet.has(watcherId) && watchedUsers.push(watchedId);
    }
    return watchedUsers;
  }

  /**
   * @description 친구 토글 리스트를 보고 있는 유저가 특정 유저의 유저 컴포넌트를 보는 경우
   *              보여 지고 있는 유저 컴포넌트의 유저를 보고 있는 유저들 목록에 추가
   *
   * @param watchedId 보여지고 있는 유저 컴포넌트의 유저 ID
   * @param watcherId 보고 있는 유저의 ID
   */
  setFriendWatchingUser(watchedId: UserId, watcherId: UserId) {
    const watcherSet = this.friendWatchers.get(watchedId);
    watcherSet === undefined
      ? this.friendWatchers.set(watchedId, new Set([watcherId]))
      : watcherSet.add(watcherId);
  }

  /**
   * @description 유저가 친구 토글 리스트를 닫을 때, 떠나는 유저를 유저 컴포넌트가 보여 지고 있는
   *              유저들을 보고 있는 유저들 목록에서 삭제
   * @param watcherId 떠나는 유저의 ID
   */
  deleteFriendWatchingUser(watcherId: UserId) {
    for (const [watchedId, watcherSet] of this.friendWatchers) {
      watcherSet.delete(watcherId);
      watcherSet.size === 0 && this.friendWatchers.delete(watchedId);
    }
  }
}
