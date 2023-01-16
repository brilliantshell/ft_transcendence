import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BlockedUsers } from '../entity/blocked-users.entity';
import { Friends } from '../entity/friends.entity';
import {
  PeerInfo,
  Relationship,
  RelationshipAction,
  UserId,
} from '../util/type';
import { Users } from '../entity/users.entity';

@Injectable()
export class UserRelationshipStorage {
  private users: Map<UserId, Map<UserId, PeerInfo>> = new Map<
    UserId,
    Map<UserId, PeerInfo>
  >();

  constructor(
    @InjectRepository(Users)
    private usersRepository: Repository<Users>,
    @InjectRepository(Friends)
    private friendsRepository: Repository<Friends>,
    @InjectRepository(BlockedUsers)
    private blockedUsersRepository: Repository<BlockedUsers>,
  ) {}

  load(userId: UserId) {
    this.users.set(userId, new Map<UserId, PeerInfo>().set(-4242, null));
  }

  unload(userId: UserId) {
    console.log(userId);
  }

  getRelationship(from: UserId, to: UserId): Relationship {
    if (!this.users.get(from).has(to)) {
      return null;
    }
    return this.users.get(from).get(to).relationship;
  }

  async addRelationship(from: UserId, to: UserId, action: RelationshipAction) {
    try {
      await this.friendsRepository.save({ sender_id: from, receiver_id: to });
    } catch (e) {
      console.error(e);
      throw new InternalServerErrorException(
        `Failed to add a relationship (${
          action === 'friendRequest' ? 'friend request' : 'block'
        })`,
      );
    }
    const provider = this.users.get(from);
    const consumer = this.users.get(to);
    const providerToConsumer = provider.get(to);
    provider.set(to, {
      relationship: action === 'friendRequest' ? 'pendingSender' : 'blocker',
      dmId: providerToConsumer ? providerToConsumer.dmId : null,
    });
    if (consumer) {
      const consumerToProvider = consumer.get(from);
      consumer.set(from, {
        relationship:
          action === 'friendRequest' ? 'pendingReceiver' : 'blocked',
        dmId: consumerToProvider ? consumerToProvider.dmId : null,
      });
    }
  }

  async acceptFriendRequest(receiver: UserId, sender: UserId) {
    try {
      await this.friendsRepository.update(
        { sender_id: sender, receiver_id: receiver },
        { is_accepted: true },
      );
    } catch (e) {
      console.error(e);
      throw new InternalServerErrorException(
        'Failed to accept a friend request',
      );
    }

    this.users.get(receiver).get(sender).relationship = 'friend';
    const senderRelationships = this.users.get(sender);
    if (senderRelationships) {
      senderRelationships.get(receiver).relationship = 'friend';
    }
  }

  async deleteRelationship(from: UserId, to: UserId) {
    try {
      await this.friendsRepository
        .createQueryBuilder()
        .delete()
        .where(
          '(sender_id = :from AND receiver_id = :to) OR (sender_id = :to AND receiver_id = :from)',
          { from, to },
        )
        .execute();
    } catch (e) {
      console.error(e);
      throw new InternalServerErrorException('Failed to delete a relationship');
    }
    this.users.get(from).delete(to);
    this.users.get(to)?.delete(from);
  }

  getRelationshipMap(userId: UserId): Map<UserId, PeerInfo> {
    return this.users.get(userId);
  }
}
