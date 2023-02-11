import { bufferCount, of } from 'rxjs';
import { faker } from '@faker-js/faker';

import { AccessMode, Channels } from '../src/entity/channels.entity';
import { Achievers } from '../src/entity/achievers.entity';
import { Achievements } from '../src/entity/achievements.entity';
import { BannedMembers } from '../src/entity/banned-members.entity';
import { BlockedUsers } from '../src/entity/blocked-users.entity';
import { ChannelId, UserId } from '../src/util/type';
import { ChannelMembers } from '../src/entity/channel-members.entity';
import { DateTimeTransformer } from '../src/entity/date-time.transformer';
import { Friends } from '../src/entity/friends.entity';
import { MatchHistory } from '../src/entity/match-history.entity';
import { Messages } from '../src/entity/messages.entity';
import { Users } from '../src/entity/users.entity';

// SECTION : Users
const createRandomUser = (): Users => {
  const user = new Users();
  user.userId = faker.helpers.unique(faker.datatype.number, [
    { min: 10000, max: 99999 },
  ]);
  user.authEmail = faker.helpers.unique(faker.internet.email);
  user.ladder = faker.datatype.number(100);
  user.lossCount = faker.datatype.number(100);
  user.nickname = faker.helpers.unique(faker.name.firstName);
  user.profileImage = `/asset/${user.userId}/profile.png`;
  user.winCount = faker.datatype.number(100);
  return user;
};

export const generateUsers = (size: number) => {
  const users = Array<Users>(size)
    .fill(null)
    .map(() => createRandomUser());
  return users;
};

// SECTION : Friends
export const generateFriends = (users: Users[]): Friends[] => {
  const friend: Friends[] = [];
  const ob = of(...users);
  ob.pipe(bufferCount(2)).subscribe((v) => {
    const f = new Friends();
    f.senderId = v[0].userId;
    f.receiverId = v[1].userId;
    f.isAccepted = faker.datatype.boolean();
    friend.push(f);
  });
  return friend;
};

// SECTION : BlockedUsers
export const generateBlockedUsers = (users: Users[]): BlockedUsers[] => {
  const blockedUser: BlockedUsers[] = [];

  const ob = of(...users);
  ob.pipe(bufferCount(2)).subscribe((v) => {
    const b = new BlockedUsers();
    b.blockerId = v[0].userId;
    b.blockedId = v[1].userId;
    blockedUser.push(b);
  });
  return blockedUser;
};

// SECTION : Channels
const createRandomChannel = (users: Users[]): Channels => {
  const channel = new Channels();
  channel.name = faker.name.firstName();
  channel.accessMode = faker.helpers.arrayElement<AccessMode>([
    AccessMode.PRIVATE,
    AccessMode.PROTECTED,
    AccessMode.PUBLIC,
  ]);
  channel.password =
    channel.accessMode === AccessMode.PROTECTED
      ? faker.internet.password()
      : null;
  channel.modifiedAt = new DateTimeTransformer().from(faker.date.past());
  channel.ownerId = faker.helpers.arrayElement(users).userId;
  channel.dmPeerId = null;
  channel.memberCount = 1;
  return channel;
};

export const generateChannels = (users: Users[]): Channels[] => {
  const channels: Channels[] = [];
  const pastDms: [number, number][] = [];
  users.forEach((user) => {
    const channel = createRandomChannel(users);
    if (
      channel.accessMode === AccessMode.PRIVATE &&
      faker.datatype.boolean() &&
      channel.ownerId !== user.userId &&
      !pastDms.includes([channel.ownerId, user.userId]) &&
      !pastDms.includes([user.userId, channel.ownerId])
    ) {
      channel.dmPeerId = user.userId;
      channel.memberCount = 2;
      pastDms.push([channel.ownerId, channel.dmPeerId]);
      pastDms.push([channel.dmPeerId, channel.ownerId]);
    } else {
      channel.memberCount = faker.datatype.number({ min: 2, max: 10 });
    }
    channels.push(channel);
  });
  return channels;
};

// SECTION : ChannelMembers

export const createChannelMember = (
  userId: UserId,
  channelId: ChannelId,
  isAdmin = false,
) => {
  const transformer = new DateTimeTransformer();
  const channelMember = new ChannelMembers();
  channelMember.memberId = userId;
  channelMember.channelId = channelId;
  channelMember.isAdmin = isAdmin ? true : faker.datatype.boolean();
  channelMember.viewedAt = transformer.from(faker.date.past());
  channelMember.muteEndAt = isAdmin
    ? transformer.from(faker.date.past())
    : faker.datatype.boolean()
    ? transformer.from(faker.date.future())
    : transformer.from(faker.date.recent());
  return channelMember;
};

export const generateChannelMembers = (
  users: Users[],
  channels: Channels[],
) => {
  const channelMembers: ChannelMembers[] = [];
  channels.forEach((channel) => {
    channelMembers.push(
      createChannelMember(channel.ownerId, channel.channelId, true),
    );
    if (channel.dmPeerId) {
      return channelMembers.push(
        createChannelMember(channel.dmPeerId, channel.channelId),
      );
    }
    const currentMembers: ChannelMembers[] = [];
    for (let i = 0; i < channel.memberCount - 1; ++i) {
      let id = faker.helpers.arrayElement(users).userId;
      while (
        id === channel.ownerId ||
        currentMembers.some((v) => v.memberId === id)
      ) {
        id = faker.helpers.arrayElement(users).userId;
      }
      currentMembers.push(createChannelMember(id, channel.channelId));
    }
    channelMembers.push(...currentMembers);
  });

  return channelMembers;
};

// SECTION : Messages
const createRandomMessage = (senderId: UserId, channelId: ChannelId) => {
  const message = new Messages();
  message.senderId = senderId;
  message.channelId = channelId;
  message.contents = faker.lorem.word({ length: { min: 1, max: 4096 } });
  message.createdAt = new DateTimeTransformer().from(faker.date.past());
  return message;
};

export const generateMessages = (members: ChannelMembers[]) => {
  const messages: Messages[] = [];
  members.forEach((member) => {
    for (let i = 0; i < faker.datatype.number({ min: 1, max: 10 }); ++i) {
      messages.push(createRandomMessage(member.memberId, member.channelId));
    }
  });
  return messages;
};

// SECTION : Banned Members
export const generateBannedMembers = (members: ChannelMembers[]) => {
  const bannedMembers: BannedMembers[] = [];
  members.forEach((member) => {
    if (faker.datatype.boolean()) {
      return;
    }
    if (faker.datatype.boolean()) {
      return;
    }
    const bannedMember = new BannedMembers();
    bannedMember.memberId = member.memberId;
    bannedMember.channelId = member.channelId;
    bannedMember.endAt = new DateTimeTransformer().from(faker.date.soon());
    bannedMembers.push(bannedMember);
  });
  return bannedMembers;
};

export const ACHIEVEMENTS_ENTITIES = [
  {
    achievementId: 1,
    title: 'one giant leap for mankind.',
    about:
      '누군가에겐 미약해 보일 수 있지만, 분명히 그것은 위대한 첫 걸음 입니다. 당신은 처음으로 승리하였습니다.',
  },
  {
    achievementId: 2,
    title: 'World Best Ping-Pong Player',
    about: '초월적인 온라인 탁구 게임에서 1등을 거머쥐었습니다!',
  },
  {
    achievementId: 3,
    title: 'Social Animal',
    about: '무려 10명의 친구! 아리스토텔레스가 당신을 부러워합니다.',
  },
  {
    achievementId: 4,
    title: ' Born To Be FT',
    about:
      '삶, 우주, 그리고 모든 것에 대한 궁극적인 질문에 대한 해답은 바로 당신!',
  },
  {
    achievementId: 5,
    title: 'So noisy~ ',
    about: 'Join 5 channels',
  },
];

export const generateAchievers = (
  users: Users[],
  achievements: Achievements[],
) => {
  const achievers: Achievers[] = [];
  users.forEach((user) => {
    const SIZE = faker.datatype.number({
      min: 0,
      max: achievements.length,
    });
    for (let i = 0; i < SIZE; ++i) {
      const achiever = new Achievers();
      achiever.userId = user.userId;
      achiever.achievementId = i + 1;
      achievers.push(achiever);
    }
  });
  return achievers;
};

export const generateMatchHistory = (users: Users[]) => {
  const matchHistories: MatchHistory[] = [];
  users.forEach((user) => {
    const SIZE = faker.datatype.number({
      min: 0,
      max: users.length / 10,
    });
    for (let i = 0; i < SIZE; ++i) {
      const matchHistory = new MatchHistory();
      matchHistory.userOneId = user.userId;
      matchHistory.userTwoId = users.filter((u) => u.userId !== user.userId)[
        i
      ].userId;
      matchHistory.userOneScore = faker.datatype.number({
        min: 0,
        max: 5,
      });
      matchHistory.userTwoScore = faker.datatype.number({
        min: 0,
        max: 5,
      });
      matchHistory.endAt = new DateTimeTransformer().from(faker.date.past());
      matchHistory.isRank = faker.datatype.boolean();
      matchHistories.push(matchHistory);
    }
  });
  return matchHistories;
};

export const updateUsersFromMatchHistory = (
  users: Users[],
  matchHistory: MatchHistory[],
) => {
  users.forEach((user) => {
    const userMatchHistoryAsOne = matchHistory.filter(
      (history) => history.userOneId === user.userId,
    );
    user.winCount = userMatchHistoryAsOne.filter(
      (history) => history.userOneScore > history.userTwoScore,
    ).length;
    user.lossCount = userMatchHistoryAsOne.filter(
      (history) => history.userOneScore < history.userTwoScore,
    ).length;
    const userMatchHistoryAsTwo = matchHistory.filter(
      (history) => history.userTwoId === user.userId,
    );
    user.winCount += userMatchHistoryAsTwo.filter(
      (history) => history.userOneScore < history.userTwoScore,
    ).length;
    user.lossCount += userMatchHistoryAsTwo.filter(
      (history) => history.userOneScore > history.userTwoScore,
    ).length;
  });
};
