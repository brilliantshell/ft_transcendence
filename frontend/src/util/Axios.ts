import axios from 'axios';

const instance = axios.create({
  baseURL: 'http://localhost:3000',
});
// FIXME : x-user-id 보내기
instance.defaults.headers.common['x-user-id'] = 47281;

export default instance;
