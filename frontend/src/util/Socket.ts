import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  extraHeaders: {
    'x-user-id': '20834',
  },
  withCredentials: true,
});

export const initSocketConnection = () => {
  if (socket.connected) return socket;
  socket.connect();
};

export default socket;
