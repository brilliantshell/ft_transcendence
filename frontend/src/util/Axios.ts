import axios from 'axios';
import { ErrorAlert } from './Alert';

const instance =
  import.meta.env.DEV === true
    ? axios.create({
        baseURL: 'http://localhost:3000/api',
      })
    : axios.create({
        baseURL: '/api',
      });

instance.interceptors.response.use(
  response => {
    return response;
  },
  async error => {
    const status = error?.response?.status;
    if (status === undefined || status >= 500) {
      await ErrorAlert('오류가 발생하였습니다.', '잠시 후 다시 시도해주세요.');
    } else if (error?.response?.status === 401) {
      await ErrorAlert('로그인이 필요합니다.', '로그인 페이지로 이동합니다.');
      window.location.href = '/login';
    } else {
      return Promise.reject(error);
    }
    return new Promise(() => {});
  },
);

// FIXME : x-user-id 보내기
instance.defaults.headers.common['x-user-id'] =
  sessionStorage.getItem('x-user-id') ?? import.meta.env.VITE_X_USER_ID;

export default instance;
