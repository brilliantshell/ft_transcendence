import { atom, selector } from 'recoil';
import instance from './Axios';
import {
  activityData,
  relationshipData,
} from '../components/hooks/SocketOnHooks';

export const myIdState = atom<number>({
  key: 'myIdState',
  default: selector({
    key: 'myId/Default',
    get: async () => {
      const data = await instance.get('/user/id');
      return data.data.userId;
    },
  }),
});

export const userActivity = atom<Map<number, activityData>>({
  key: 'userActivity',
  default: new Map<number, activityData>(),
});

export const userRelationship = atom<Map<number, relationshipData>>({
  key: 'userRelationship',
  default: new Map<number, relationshipData>(),
});
