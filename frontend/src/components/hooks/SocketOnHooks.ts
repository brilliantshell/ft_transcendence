import { useEffect } from 'react';
import socket from '../../util/Socket';
import { userActivity, userRelationship } from '../../util/Recoils';
import { useSetRecoilState } from 'recoil';

export interface activityData {
  userId: number;
  activity: 'offline' | 'online' | 'inGame';
  gameId: string | null;
}

export interface relationshipData {
  userId: number;
  relationship:
    | 'friend'
    | 'pendingSender'
    | 'pendingReceiver'
    | 'blocked'
    | 'blocker'
    | 'normal';
}

export function useSocketOn() {
  const setActivityMap = useSetRecoilState(userActivity);
  const setRelationshipMap = useSetRecoilState(userRelationship);

  useEffect(() => {
    socket.on('userActivity', data => {
      setActivityMap(prev => {
        const copy = new Map(prev);
        copy.set(data.userId, data);
        return copy;
      });
    });
    socket.on('userRelationship', data => {
      setRelationshipMap(prev => {
        const copy = new Map(prev);
        copy.set(data.userId, data);
        return copy;
      });
    });
    return () => {
      socket.off('userActivity');
      socket.off('userRelationship');
    };
  }, []);
}
