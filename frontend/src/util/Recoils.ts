import {
  activityData,
  relationshipData,
} from '../components/hooks/SocketOnHooks';
import { atom, atomFamily, selector } from 'recoil';
import instance from './Axios';
import { userData } from '../components/User/UserBase';

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

export const gamesInProgressState = atom<
  { id: string; left: string; right: string }[]
>({
  key: 'gamesInProgressState',
  default: [],
});

export const userActivity = atom<Map<number, activityData>>({
  key: 'userActivity',
  default: new Map<number, activityData>(),
});

export const userRelationship = atom<Map<number, relationshipData>>({
  key: 'userRelationship',
  default: new Map<number, relationshipData>(),
});

export const editProfileState = atom<boolean>({
  key: 'editProfileState',
  default: false,
});

export const userAtomFamily = atomFamily<userData, number>({
  key: 'userAtomFamily',
  default: id => ({
    id,
    nickname: '',
    isDefaultImage: true,
  }),
});
