import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  extraHeaders: {
    'x-user-id': window.sessionStorage.getItem('user_id') ||  import.meta.env.VITE_X_USER_ID,
  },
  withCredentials: true,
});

export const listenEvent = <T>(event: string) =>
  new Promise<T>(resolve => socket.on(event, resolve));

 export default socket;
