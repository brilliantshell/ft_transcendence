import axios from 'axios';

const instance = axios.create({
  baseURL: 'https://72ba9975-b12b-4f33-828d-8c733f495951.mock.pstmn.io',
});
// FIXME : x-user-id 보내기
// instance.defaults.headers.common['x-user-id'] = 10;

export default instance;
