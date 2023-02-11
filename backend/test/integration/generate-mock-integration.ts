import { DataSource } from 'typeorm';
import { exit } from 'process';

import {
  ACHIEVEMENTS_ENTITIES,
  generateAchievers,
  generateBannedMembers,
  generateBlockedUsers,
  generateChannelMembers,
  generateChannels,
  generateFriends,
  generateMatchHistory,
  generateMessages,
  generateUsers,
  updateUsersFromMatchHistory,
} from '../generate-mock-data';
import { Achievements } from '../../src/entity/achievements.entity';
import { Achievers } from '../../src/entity/achievers.entity';
import { BannedMembers } from '../../src/entity/banned-members.entity';
import { BlockedUsers } from '../../src/entity/blocked-users.entity';
import { ChannelMembers } from '../../src/entity/channel-members.entity';
import { Channels } from '../../src/entity/channels.entity';
import { Friends } from '../../src/entity/friends.entity';
import { MatchHistory } from '../../src/entity/match-history.entity';
import { Messages } from '../../src/entity/messages.entity';
import { Users } from '../../src/entity/users.entity';
import { createDataSources } from '../db-resource-manager';

const usersEntities = generateUsers(300);
const baseUsers = usersEntities.slice(0, 99);
const usersPool = [
  usersEntities.slice(100, 199),
  usersEntities.slice(200, usersEntities.length - (usersEntities.length % 3)),
];

const friendsCandidates: Users[] = [];
const blockCandidates: Users[] = [];
usersPool.forEach((pool) => {
  baseUsers.forEach((user, i) => {
    if (i + 2 >= pool.length) return;
    const mod = i % 3;
    switch (mod) {
      case 0:
        friendsCandidates.push(user, pool[i]);
        blockCandidates.push(user, pool[i + 1]);
        friendsCandidates.push(pool[i + 2], user);
        break;
      case 1:
        friendsCandidates.push(user, pool[i]);
        blockCandidates.push(user, pool[i + 1]);
        friendsCandidates.push(pool[i - 1], user);
        break;
      case 2:
        friendsCandidates.push(user, pool[i]);
        blockCandidates.push(user, pool[i - 1]);
        friendsCandidates.push(pool[i - 2], user);
        break;
    }
  });
});

const friendsEntities = generateFriends(friendsCandidates);
const blockedUsersEntities = generateBlockedUsers(blockCandidates);

const channelsEntities = generateChannels(usersEntities.slice(200));
channelsEntities.forEach((channel, i) => {
  channel.channelId = i + 1;
});

const channelMembersEntities = generateChannelMembers(
  usersEntities,
  channelsEntities,
);

const bannedMembersEntities = generateBannedMembers(channelMembersEntities);

channelMembersEntities.filter((cm) => {
  return bannedMembersEntities.some((bm) => {
    return cm.channelId === bm.channelId && cm.memberId === bm.memberId;
  });
});

const messagesEntities = generateMessages(channelMembersEntities);

const matchHistoryEntities = generateMatchHistory(usersEntities);
updateUsersFromMatchHistory(usersEntities, matchHistoryEntities);

const achieversEntities = generateAchievers(
  usersEntities,
  ACHIEVEMENTS_ENTITIES,
);

let dataSource: DataSource, initDataSource: DataSource;
async function saveData() {
  const dataSources = await createDataSources('test_db_integration', [
    Achievements,
    Achievers,
    BannedMembers,
    BlockedUsers,
    ChannelMembers,
    Channels,
    Friends,
    MatchHistory,
    Messages,
    Users,
  ]);
  dataSource = dataSources.dataSource;
  initDataSource = dataSources.initDataSource;

  await dataSource.getRepository(Users).save(usersEntities);
  await dataSource.getRepository(Channels).save(channelsEntities);
  await dataSource.getRepository(Friends).save(friendsEntities);
  await dataSource.getRepository(BlockedUsers).save(blockedUsersEntities);
  await dataSource.getRepository(ChannelMembers).save(channelMembersEntities);
  await dataSource.getRepository(BannedMembers).save(bannedMembersEntities);
  await dataSource.getRepository(Messages).save(messagesEntities);
  await dataSource.getRepository(Achievements).save(ACHIEVEMENTS_ENTITIES);
  await dataSource.getRepository(Achievers).save(achieversEntities);
  await dataSource.getRepository(MatchHistory).save(matchHistoryEntities);
}

saveData()
  .then(() => {
    console.log('\x1b[32m%s\x1b[0m', 'SUCCESS');
  })
  .catch((e) => {
    console.log('\x1b[31m%s\x1b[0m', e);
    initDataSource
      .createQueryRunner()
      .query(`DROP DATABASE test_db_integration WITH (FORCE)`);
  })
  .finally(() => {
    Promise.all([dataSource.destroy(), initDataSource.destroy()]).then(() =>
      exit(),
    );
  });
