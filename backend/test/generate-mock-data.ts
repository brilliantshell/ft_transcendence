import { bufferCount, of } from 'rxjs';
import { faker } from '@faker-js/faker';

import { AccessMode, Channels } from '../src/entity/channels.entity';
import { BannedMembers } from '../src/entity/banned-members.entity';
import { BlockedUsers } from '../src/entity/blocked-users.entity';
import { ChannelId, UserId } from '../src/util/type';
import { ChannelMembers } from '../src/entity/channel-members.entity';
import { DateTimeTransformer } from '../src/entity/date-time.transformer';
import { Friends } from '../src/entity/friends.entity';
import { Messages } from '../src/entity/messages.entity';
import { Users } from '../src/entity/users.entity';

// SECTION : Users
const createRandomUser = (): Users => {
  const user = new Users();
  user.auth_email = faker.helpers.unique(faker.internet.email);
  user.ladder = faker.datatype.number(100);
  user.loss_cnt = faker.datatype.number(100);
  user.nickname = faker.helpers.unique(faker.name.firstName);
  user.profile_image = faker.image.imageUrl();
  user.win_cnt = faker.datatype.number(100);
  user.user_id = faker.helpers.unique(faker.datatype.number, [
    { min: 10000, max: 99999 },
  ]);
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
    f.sender_id = v[0].user_id;
    f.receiver_id = v[1].user_id;
    f.is_accepted = faker.datatype.boolean();
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
    b.blocker_id = v[0].user_id;
    b.blocked_id = v[1].user_id;
    blockedUser.push(b);
  });
  return blockedUser;
};

// SECTION : Channels
const createRandomChannel = (users: Users[]): Channels => {
  const channel = new Channels();
  channel.channel_name = faker.name.firstName();
  channel.access_mode = faker.helpers.arrayElement<AccessMode>([
    AccessMode.PRIVATE,
    AccessMode.PROTECTED,
    AccessMode.PUBLIC,
  ]);
  channel.passwd =
    channel.access_mode === AccessMode.PROTECTED
      ? faker.internet.password()
      : null;
  channel.modified_at = new DateTimeTransformer().from(faker.date.past());
  channel.owner_id = faker.helpers.arrayElement(users).user_id;
  channel.dm_peer_id = null;
  channel.member_cnt = 1;
  return channel;
};

export const generateChannels = (users: Users[]): Channels[] => {
  const channels: Channels[] = [];
  const pastDms: [number, number][] = [];
  users.forEach((user) => {
    const channel = createRandomChannel(users);
    if (
      channel.access_mode === AccessMode.PRIVATE &&
      faker.datatype.boolean() &&
      channel.owner_id !== user.user_id &&
      !pastDms.includes([channel.owner_id, user.user_id]) &&
      !pastDms.includes([user.user_id, channel.owner_id])
    ) {
      channel.dm_peer_id = user.user_id;
      channel.member_cnt = 2;
      pastDms.push([channel.owner_id, channel.dm_peer_id]);
      pastDms.push([channel.dm_peer_id, channel.owner_id]);
    } else {
      channel.member_cnt = faker.datatype.number({ min: 2, max: 10 });
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
  channelMember.member_id = userId;
  channelMember.channel_id = channelId;
  channelMember.is_admin = isAdmin ? true : faker.datatype.boolean();
  channelMember.viewed_at = transformer.from(faker.date.past());
  channelMember.mute_end_time = isAdmin
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
      createChannelMember(channel.owner_id, channel.channel_id, true),
    );
    if (channel.dm_peer_id) {
      return channelMembers.push(
        createChannelMember(channel.dm_peer_id, channel.channel_id),
      );
    }
    const currentMembers: ChannelMembers[] = [];
    for (let i = 0; i < channel.member_cnt - 1; ++i) {
      let id = faker.helpers.arrayElement(users).user_id;
      while (
        id === channel.owner_id ||
        currentMembers.some((v) => v.member_id === id)
      ) {
        id = faker.helpers.arrayElement(users).user_id;
      }
      currentMembers.push(createChannelMember(id, channel.channel_id));
    }
    channelMembers.push(...currentMembers);
  });

  return channelMembers;
};

// SECTION : Messages
const createRandomMessage = (senderId: UserId, channelId: ChannelId) => {
  const message = new Messages();
  message.sender_id = senderId;
  message.channel_id = channelId;
  message.contents = faker.lorem.word({ length: { min: 1, max: 4096 } });
  message.created_at = new DateTimeTransformer().from(faker.date.past());
  return message;
};

export const generateMessages = (members: ChannelMembers[]) => {
  const messages: Messages[] = [];
  members.forEach((member) => {
    for (let i = 0; i < faker.datatype.number({ min: 1, max: 10 }); ++i) {
      messages.push(createRandomMessage(member.member_id, member.channel_id));
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
    bannedMember.member_id = member.member_id;
    bannedMember.channel_id = member.channel_id;
    bannedMember.end_time = new DateTimeTransformer().from(faker.date.soon());
    bannedMembers.push(bannedMember);
  });
  return bannedMembers;
};
