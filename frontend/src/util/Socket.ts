import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  extraHeaders: {
    'x-user-id': import.meta.env.VITE_X_USER_ID,
  },
  withCredentials: true,
});

export const initSocketConnection = () => {
  if (socket.connected) return socket;
  socket.connect();
};

export default socket;
