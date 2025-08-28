import io from 'socket.io-client';

const socket = io(process.env.REACT_APP_BACKEND_URL, {
  // Socket connection options can be added here if needed in the future
});

export default socket;
