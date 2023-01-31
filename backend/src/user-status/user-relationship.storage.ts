import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

import { BlockedUsers } from '../entity/blocked-users.entity';
import { ChannelId, Relationship, UserId } from '../util/type';
import { Channels } from '../entity/channels.entity';
import { Friends } from '../entity/friends.entity';

const FRIENDSHIP_TYPES: Relationship[] = [
  'friend',
  'pendingSender',
  'pendingReceiver',
];
const BLOCK_TYPES: Relationship[] = ['blocker', 'blocked'];

@Injectable()
export class UserRelationshipStorage implements OnModuleInit {
  private dms: Map<ChannelId, boolean> = new Map<ChannelId, boolean>();
  private users: Map<UserId, Map<UserId, Relationship>> = new Map<
    UserId,
    Map<UserId, Relationship>
  >();

  private readonly blockedUsersRepository: Repository<BlockedUsers>;
  private readonly channelsRepository: Repository<Channels>;
  private readonly friendsRepository: Repository<Friends>;
  private readonly logger = new Logger(UserRelationshipStorage.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource, // @InjectRepository(BlockedUsers) // private readonly blockedUsersRepository: Repository<BlockedUsers>, // @InjectRepository(Channels) // private readonly channelsRepository: Repository<Channels>, // @InjectRepository(Friends) // private readonly friendsRepository: Repository<Friends>,
  ) {
    this.blockedUsersRepository = this.dataSource.getRepository(BlockedUsers);
    this.channelsRepository = this.dataSource.getRepository(Channels);
    this.friendsRepository = this.dataSource.getRepository(Friends);
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Public methods                                                  *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description dependency resolution 시 init() 호출
   *
   */
  async onModuleInit() {
    await this.init();
  }

  /**
   * @description App bootstrap 시 DM 채널들의 readonly 여부 캐싱
   *
   */
  async init() {
    try {
      const dmChannels = await this.channelsRepository.find({
        select: ['channelId', 'dmPeerId', 'ownerId'],
        where: { dmPeerId: Not(IsNull()) },
      });
      const blocks: Partial<BlockedUsers>[] =
        await this.blockedUsersRepository.find();
      dmChannels.forEach(({ channelId, ownerId, dmPeerId }) => {
        const possibleBlocks = [
          { blockerId: ownerId, blockedId: dmPeerId },
          { blockerId: dmPeerId, blockedId: ownerId },
        ];
        this.dms.set(
          channelId,
          blocks.includes(possibleBlocks[0]) ||
            blocks.includes(possibleBlocks[1]),
        );
      });
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(
        'Failed to initialize user relationships',
      );
    }
  }

  /**
   * @description 유저가 접속 시 다른 유저와 관계를 캐싱
   *
   * @param userId 접속한 유저의 id
   */
  async load(userId: UserId) {
    this.users.set(userId, new Map<UserId, Relationship>());
    const relationshipMap = this.users.get(userId);
    let friends: Friends[];
    let blocks: BlockedUsers[];
    try {
      friends = await this.friendsRepository.findBy([
        { senderId: userId },
        { receiverId: userId },
      ]);
      blocks = await this.blockedUsersRepository.findBy([
        { blockerId: userId },
        { blockedId: userId },
      ]);
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException(
        'Failed to load user relationships',
      );
    }
    friends.forEach(({ senderId, receiverId, isAccepted }) => {
      const [peerId, pendingStatus]: [UserId, Relationship] =
        senderId === userId
          ? [receiverId, 'pendingSender']
          : [senderId, 'pendingReceiver'];
      relationshipMap.set(peerId, isAccepted ? 'friend' : pendingStatus);
    });
    blocks.forEach(({ blockerId, blockedId }) => {
      const [counterpartId, status]: [UserId, Relationship] =
        blockerId === userId ? [blockedId, 'blocker'] : [blockerId, 'blocked'];
      relationshipMap.set(counterpartId, status);
    });
  }

  /**
   * @description 유저가 나갈 때 다른 유저와 관계를 캐시에서 제거
   *
   * @param userId 나간 유저의 id
   */
  unload(userId: UserId) {
    this.users.delete(userId);
  }

  /**
   * @description from 유저와 to 유저의 관계를 반환
   *
   * @param from 유저의 id
   * @param to 유저의 id
   * @returns from 유저와 to 유저의 관계
   */
  getRelationship(from: UserId, to: UserId) {
    if (!this.users.has(from) || !this.users.get(from).has(to)) {
      return null;
    }
    return this.users.get(from).get(to);
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : DM methods                                                      *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description dm 채널의 readonly 여부를 반환
   *
   * @param channelId dm 채널의 id
   * @returns dm 채널의 readonly 여부
   */
  isBlockedDm(channelId: ChannelId): boolean {
    return this.dms.get(channelId);
  }

  /**
   * @description 새로운 dm 채널의 readonly 여부를 캐싱
   *
   */
  addDm(channelId: ChannelId) {
    this.dms.set(channelId, false);
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Block methods                                                   *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 차단 관계 추가
   *
   * @param blockerId 차단하는 유저의 id
   * @param blockedId 차단 당하는 유저의 id
   */
  async blockUser(blockerId: UserId, blockedId: UserId) {
    try {
      await this.dataSource.manager.transaction(async (manager) => {
        await manager.save(BlockedUsers, { blockerId, blockedId });
        await this.setDmReadonly(blockerId, blockedId);
        FRIENDSHIP_TYPES.includes(this.users.get(blockerId).get(blockedId)) &&
          (await this.queryConditionalDelete(
            manager.withRepository(this.friendsRepository),
            blockerId,
            blockedId,
          ));
      });
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException('Failed to block a user');
    }
    this.users.get(blockerId).set(blockedId, 'blocker');
    this.users.get(blockedId)?.set(blockerId, 'blocked');
  }

  /**
   * @description 차단 해제
   *
   * @param unblocker 차단 해제하는 유저의 id
   * @param unblocked 차단 해제되는 유저의 id
   */
  async unblockUser(unblocker: UserId, unblocked: UserId) {
    const relationship = this.users.get(unblocker).get(unblocked);
    // FIXME : Guard 로 막으면 필요 없을수도
    if ('blocker' !== relationship) {
      throw new BadRequestException('Invalid relationship');
    }
    try {
      await this.queryConditionalDelete(
        this.blockedUsersRepository,
        unblocker,
        unblocked,
      );
      await this.setDmReadonly(unblocker, unblocked, false);
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException('Failed to unblock a user');
    }
    this.users.get(unblocker).delete(unblocked);
    this.users.get(unblocked)?.delete(unblocker);
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Friend methods                                                  *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 수락 전 친구 관계 추가
   *
   * @param senderId 친구 추가 요청을 보낸 유저의 id
   * @param receiverId 친구 추가 요청을 받은 유저의 id
   */
  async sendFriendRequest(senderId: UserId, receiverId: UserId) {
    if (BLOCK_TYPES.includes(this.users.get(senderId).get(receiverId))) {
      throw new BadRequestException('Invalid relationship');
    }
    try {
      await this.friendsRepository.save({ senderId, receiverId });
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException('Failed to send a friend request');
    }
    this.users.get(senderId).set(receiverId, 'pendingSender');
    this.users.get(receiverId)?.set(senderId, 'pendingReceiver');
  }

  /**
   * @description 친구 요청 수락
   *
   * @param receiver 요청을 수락한 유저의 id
   * @param sender 요청을 보낸 유저의 id
   */
  async acceptFriendRequest(receiverId: UserId, senderId: UserId) {
    if (BLOCK_TYPES.includes(this.users.get(receiverId).get(senderId))) {
      throw new BadRequestException('Invalid relationship');
    }
    try {
      const { affected } = await this.friendsRepository.update(
        { senderId, receiverId },
        { isAccepted: true },
      );
      if (affected === 0) {
        throw new NotFoundException('There is no such friend request');
      }
    } catch (e) {
      this.logger.error(e);
      throw e instanceof NotFoundException
        ? e
        : new InternalServerErrorException('Failed to accept a friend request');
    }
    this.users.get(receiverId).set(senderId, 'friend');
    this.users.get(senderId)?.set(receiverId, 'friend');
  }

  /**
   * @description 두 유저 사이의 관계 삭제
   *
   * @param from 삭제한 주체
   * @param to 삭제된 대상
   */
  async deleteFriendship(from: UserId, to: UserId) {
    const relationship = this.users.get(from).get(to);
    if (!relationship || BLOCK_TYPES.includes(relationship)) {
      throw new BadRequestException('Invalid relationship');
    }
    try {
      await this.queryConditionalDelete(this.friendsRepository, from, to);
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException('Failed to delete a friendship');
    }
    this.users.get(from).delete(to);
    this.users.get(to)?.delete(from);
  }

  /*****************************************************************************
   *                                                                           *
   * NOTE : TEST ONLY                                                          *
   *                                                                           *
   ****************************************************************************/

  getRelationshipMap(userId: UserId): Map<UserId, Relationship> {
    return this.users.get(userId);
  }

  /*****************************************************************************
   *                                                                           *
   * SECTION : Private methods                                                 *
   *                                                                           *
   ****************************************************************************/

  /**
   * @description 두 유저 사이의 DM 채널을 읽기 전용 설정 혹은 해제
   *
   * @param from block 혹은 unblock 한 유저의 id
   * @param to block 혹은 unblock 된 유저의 id
   * @param readonly 읽기 전용 여부
   */
  private async setDmReadonly(from: UserId, to: UserId, readonly = true) {
    let dm: Channels;
    try {
      dm = await this.channelsRepository.findOneBy([
        { ownerId: from, dmPeerId: to },
        { ownerId: to, dmPeerId: from },
      ]);
    } catch (e) {
      this.logger.error(e);
      throw new InternalServerErrorException('Failed to set DM readonly');
    }
    if (dm) {
      this.dms.set(dm.channelId, readonly);
    }
  }

  /**
   * @description 두 유저 사이의 관계를 DB에서 삭제
   *
   * @param repository Friends 또는 BlockedUsers Repository
   * @param userOne
   * @param userTwo
   */
  private async queryConditionalDelete(
    repository: Repository<Friends> | Repository<BlockedUsers>,
    userOne: UserId,
    userTwo: UserId,
  ) {
    const columns =
      repository.target === Friends
        ? ['sender_id', 'receiver_id']
        : ['blocker_id', 'blocked_id'];
    await repository
      .createQueryBuilder()
      .delete()
      .where(
        `(${columns[0]} = :userOne AND ${columns[1]} = :userTwo) \
          OR (${columns[0]} = :userTwo AND ${columns[1]} = :userOne)`,
        { userOne, userTwo },
      )
      .execute();
  }
}
