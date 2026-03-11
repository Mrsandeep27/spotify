import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const useStore = create((set, get) => ({
  // ─── Auth ────────────────────────────────────────────────────────
  user: null,
  setUser: (user) => set({ user }),

  // ─── Player State ────────────────────────────────────────────────
  currentSong: null,
  isPlaying: false,
  position: 0,        // seconds
  duration: 0,        // seconds
  volume: 1.0,        // 0.0 - 2.0 (>1.0 = boosted)
  isShuffled: false,
  repeatMode: 'none', // 'none' | 'all' | 'one'
  queue: [],
  queueIndex: 0,

  setCurrentSong: (song) => set({ currentSong: song, position: 0 }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPosition: (position) => set({ position }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  toggleShuffle: () => set((s) => ({ isShuffled: !s.isShuffled })),
  cycleRepeat: () =>
    set((s) => ({
      repeatMode:
        s.repeatMode === 'none' ? 'all' : s.repeatMode === 'all' ? 'one' : 'none',
    })),

  setQueue: (queue, index = 0) => set({ queue, queueIndex: index }),
  addToQueue: (song) => set((s) => ({ queue: [...s.queue, song] })),

  playNext: () => {
    const { queue, queueIndex, isShuffled, repeatMode } = get();
    if (!queue.length) return null;
    let next;
    if (isShuffled) {
      next = Math.floor(Math.random() * queue.length);
    } else if (repeatMode === 'one') {
      next = queueIndex;
    } else {
      next = (queueIndex + 1) % queue.length;
    }
    set({ queueIndex: next, currentSong: queue[next], position: 0 });
    return queue[next];
  },

  playPrev: () => {
    const { queue, queueIndex } = get();
    if (!queue.length) return null;
    const prev = (queueIndex - 1 + queue.length) % queue.length;
    set({ queueIndex: prev, currentSong: queue[prev], position: 0 });
    return queue[prev];
  },

  // ─── Liked Songs ─────────────────────────────────────────────────
  likedSongs: [],
  setLikedSongs: (songs) => set({ likedSongs: songs }),
  toggleLike: (song) => {
    const { likedSongs } = get();
    const exists = likedSongs.find((s) => s.id === song.id);
    const updated = exists
      ? likedSongs.filter((s) => s.id !== song.id)
      : [song, ...likedSongs];
    set({ likedSongs: updated });
    AsyncStorage.setItem('likedSongs', JSON.stringify(updated));
    return !exists;
  },
  isLiked: (songId) => get().likedSongs.some((s) => s.id === songId),

  // ─── Downloaded Songs ────────────────────────────────────────────
  downloadedSongs: [],
  setDownloadedSongs: (songs) => set({ downloadedSongs: songs }),
  addDownloadedSong: (song) => {
    const { downloadedSongs } = get();
    const updated = [song, ...downloadedSongs.filter((s) => s.id !== song.id)];
    set({ downloadedSongs: updated });
    AsyncStorage.setItem('downloadedSongs', JSON.stringify(updated));
  },
  removeDownloadedSong: (songId) => {
    const updated = get().downloadedSongs.filter((s) => s.id !== songId);
    set({ downloadedSongs: updated });
    AsyncStorage.setItem('downloadedSongs', JSON.stringify(updated));
  },
  isDownloaded: (songId) => get().downloadedSongs.some((s) => s.id === songId),

  // ─── Group Session ───────────────────────────────────────────────
  session: null,
  isHost: false,
  setSession: (session, isHost = false) => set({ session, isHost }),
  clearSession: () => set({ session: null, isHost: false }),

  // ─── Equalizer / Volume Booster ──────────────────────────────────
  equalizerBands: {
    bass: 0,      // -10 to +10 dB
    lowMid: 0,
    mid: 0,
    highMid: 0,
    treble: 0,
  },
  setEqualizerBand: (band, value) =>
    set((s) => ({
      equalizerBands: { ...s.equalizerBands, [band]: value },
    })),

  // ─── Hydrate from AsyncStorage ───────────────────────────────────
  hydrate: async () => {
    try {
      const [liked, downloaded] = await Promise.all([
        AsyncStorage.getItem('likedSongs'),
        AsyncStorage.getItem('downloadedSongs'),
      ]);
      if (liked) set({ likedSongs: JSON.parse(liked) });
      if (downloaded) set({ downloadedSongs: JSON.parse(downloaded) });
    } catch (e) {
      console.warn('Hydration error:', e);
    }
  },
}));

export default useStore;
