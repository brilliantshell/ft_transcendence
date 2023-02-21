import { atom, selector } from 'recoil';
import instance from './Axios';

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
