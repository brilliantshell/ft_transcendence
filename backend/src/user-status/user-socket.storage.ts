import { Injectable } from '@nestjs/common';

import { UserId, SocketId } from '../util/type';

@Injectable()
export class UserSocketStorage {
  readonly clients: Map<UserId, SocketId> = new Map();
  readonly sockets: Map<SocketId, UserId> = new Map();
}
