import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config/api';

let socket = null;

export const SocketService = {
  connect() {
    if (socket?.connected) return socket;

    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => console.log('🔌 Socket connected'));
    socket.on('disconnect', () => console.log('🔌 Socket disconnected'));
    socket.on('connect_error', (e) => console.warn('Socket error:', e.message));

    return socket;
  },

  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  joinSession(code, userId, displayName) {
    this.connect();
    socket.emit('join_session', { code, userId, displayName });
  },

  leaveSession(code, userId) {
    if (socket) socket.emit('leave_session', { code, userId });
  },

  sendPlaybackUpdate(code, { isPlaying, position, song }) {
    if (socket) socket.emit('playback_update', { code, isPlaying, position, song });
  },

  sendSeek(code, position) {
    if (socket) socket.emit('seek', { code, position });
  },

  sendSongChange(code, song) {
    if (socket) socket.emit('song_change', { code, song });
  },

  on(event, callback) {
    this.connect();
    socket.on(event, callback);
  },

  off(event, callback) {
    if (socket) socket.off(event, callback);
  },

  getSocket() {
    return socket;
  },
};
