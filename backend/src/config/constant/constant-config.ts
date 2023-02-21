export const WEBSOCKET_CONFIG =
  process.env.NODE_ENV === 'development'
    ? {
        cors: { origin: 'http://localhost:5173', credentials: true },
      }
    : {};
