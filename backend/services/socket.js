const { sessions } = require('../routes/session');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    // ─── Join Session ───────────────────────────────────────────────
    socket.on('join_session', ({ code, userId, displayName }) => {
      const key = code?.toUpperCase();
      const session = sessions.get(key);

      if (!session) {
        socket.emit('session_error', { message: 'Session not found. Check the code.' });
        return;
      }

      socket.join(key);
      socket.sessionCode = key;
      socket.userId = userId;

      // Add member if not already present
      const exists = session.members.find((m) => m.userId === userId);
      if (!exists) {
        session.members.push({ userId, displayName: displayName || 'Listener', isHost: false });
      }

      // Send current playback state to new member
      socket.emit('session_joined', {
        session,
        currentSong: session.currentSong,
        isPlaying: session.isPlaying,
        position: session.position,
      });

      // Notify others
      socket.to(key).emit('member_joined', { userId, displayName });
      io.to(key).emit('members_updated', session.members);
    });

    // ─── Playback Control (host only) ───────────────────────────────
    socket.on('playback_update', ({ code, isPlaying, position, song }) => {
      const key = code?.toUpperCase();
      const session = sessions.get(key);
      if (!session || session.hostId !== socket.userId) return;

      session.isPlaying = isPlaying;
      session.position = position ?? session.position;
      if (song) session.currentSong = song;

      socket.to(key).emit('playback_sync', {
        isPlaying,
        position: session.position,
        song: session.currentSong,
      });
    });

    // ─── Seek ────────────────────────────────────────────────────────
    socket.on('seek', ({ code, position }) => {
      const key = code?.toUpperCase();
      const session = sessions.get(key);
      if (!session || session.hostId !== socket.userId) return;

      session.position = position;
      socket.to(key).emit('seek_sync', { position });
    });

    // ─── Song Change ─────────────────────────────────────────────────
    socket.on('song_change', ({ code, song }) => {
      const key = code?.toUpperCase();
      const session = sessions.get(key);
      if (!session || session.hostId !== socket.userId) return;

      session.currentSong = song;
      session.position = 0;
      session.isPlaying = true;

      socket.to(key).emit('song_changed', { song });
    });

    // ─── Leave Session ───────────────────────────────────────────────
    socket.on('leave_session', ({ code, userId }) => {
      const key = code?.toUpperCase();
      _removeMember(io, socket, key, userId);
    });

    // ─── Disconnect ──────────────────────────────────────────────────
    socket.on('disconnect', () => {
      if (socket.sessionCode && socket.userId) {
        _removeMember(io, socket, socket.sessionCode, socket.userId);
      }
      console.log('🔌 Client disconnected:', socket.id);
    });
  });
};

function _removeMember(io, socket, key, userId) {
  const session = sessions.get(key);
  if (!session) return;

  session.members = session.members.filter((m) => m.userId !== userId);

  if (session.hostId === userId) {
    // Host left — end session for everyone
    io.to(key).emit('session_ended', { message: 'Host ended the session' });
    sessions.delete(key);
  } else {
    io.to(key).emit('members_updated', session.members);
    socket.to(key).emit('member_left', { userId });
  }

  socket.leave(key);
}
