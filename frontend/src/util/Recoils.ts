import {
  activityData,
  relationshipData,
} from '../components/hooks/SocketOnHooks';
import { atom, atomFamily, selector } from 'recoil';
import instance from './Axios';
import { ErrorAlert } from './Alert';

export const myIdState = atom<number>({
  key: 'myIdState',
  default: selector({
    key: 'myId/Default',
    get: async () => {
      try {
        const data = await instance.get('/user/id');
        return data.data.userId;
      } catch (e) {
        ErrorAlert('로그인이 필요합니다.', '로그인 페이지로 이동합니다.').then(
          () => (window.location.href = '/login'),
        );
      }
    },
  }),
});

export const gamesInProgressState = atom<
  { id: string; left: string; right: string }[]
>({
  key: 'gamesInProgressState',
  default: [],
});

export const isOptionSubmittedState = atom<boolean>({
  key: 'isOptionSubmitted',
  default: false,
});

export const userActivity = atom<Map<number, activityData>>({
  key: 'userActivity',
  default: new Map<number, activityData>(),
});

export const userRelationship = atom<Map<number, relationshipData>>({
  key: 'userRelationship',
  default: new Map<number, relationshipData>(),
});
