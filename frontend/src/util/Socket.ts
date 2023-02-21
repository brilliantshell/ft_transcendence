import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  extraHeaders: {
    'x-user-id': '47281',
  },
});

export default socket;
