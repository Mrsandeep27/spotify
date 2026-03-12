import { Audio } from 'expo-av';
import { ENDPOINTS } from '../config/api';

let soundObject = null;
let onStatusUpdateCallback = null;

export const AudioPlayer = {
  async load(song, onStatusUpdate) {
    try {
      await this.unload();

      onStatusUpdateCallback = onStatusUpdate;

      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      // Get stream URL from backend
      const res = await fetch(ENDPOINTS.streamUrl(song.id));
      if (!res.ok) throw new Error('Failed to get stream URL');
      const data = await res.json();

      if (!data.streamUrl) throw new Error('No stream URL');

      const { sound } = await Audio.Sound.createAsync(
        { uri: data.streamUrl },
        { shouldPlay: true, progressUpdateIntervalMillis: 500 },
        (status) => {
          if (onStatusUpdateCallback) onStatusUpdateCallback(status);
        }
      );

      soundObject = sound;
      return sound;
    } catch (error) {
      console.error('AudioPlayer.load error:', error.message);
      throw error;
    }
  },

  async play() {
    if (soundObject) await soundObject.playAsync();
  },

  async pause() {
    if (soundObject) await soundObject.pauseAsync();
  },

  async togglePlayPause() {
    if (!soundObject) return;
    const status = await soundObject.getStatusAsync();
    if (status.isPlaying) {
      await soundObject.pauseAsync();
    } else {
      await soundObject.playAsync();
    }
  },

  async seekTo(positionMs) {
    if (soundObject) await soundObject.setPositionAsync(positionMs);
  },

  async setVolume(volume) {
    // expo-av supports volume 0.0 to 1.0
    // For "boost", we clamp to 1.0 at the expo-av level
    // but allow the UI to show 0-200%
    const clampedVolume = Math.min(Math.max(volume, 0), 1.0);
    if (soundObject) await soundObject.setVolumeAsync(clampedVolume);
  },

  async unload() {
    if (soundObject) {
      try {
        await soundObject.stopAsync();
        await soundObject.unloadAsync();
      } catch (_) {}
      soundObject = null;
    }
    onStatusUpdateCallback = null;
  },

  getSound() {
    return soundObject;
  },
};
