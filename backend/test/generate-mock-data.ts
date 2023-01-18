import { faker } from '@faker-js/faker';
import { bufferCount, of } from 'rxjs';

import { AccessMode, Channels } from '../src/entity/channels.entity';
import { BlockedUsers } from '../src/entity/blocked-users.entity';
import { Friends } from '../src/entity/friends.entity';
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
  channel.modified_at = faker.date.past();
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
    }
    channels.push(channel);
  });
  return channels;
};
