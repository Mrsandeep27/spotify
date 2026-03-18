import { Audio } from 'expo-av';
import { getStreamUrl } from './youtubeExtractor';

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

      // Get stream URL — retry once if first attempt fails
      let streamUri = song.localUri;
      if (!streamUri) {
        try {
          streamUri = await getStreamUrl(song.id);
        } catch (firstErr) {
          console.warn('[Audio] First extraction attempt failed, retrying...', firstErr.message);
          // Wait 1 second then retry
          await new Promise((r) => setTimeout(r, 1000));
          streamUri = await getStreamUrl(song.id);
        }
      }

      console.log('[Audio] Loading URI:', streamUri?.substring(0, 80) + '...');

      const { sound } = await Audio.Sound.createAsync(
        { uri: streamUri },
        { shouldPlay: true, progressUpdateIntervalMillis: 500 },
        (status) => {
          if (onStatusUpdateCallback) onStatusUpdateCallback(status);
        }
      );

      soundObject = sound;
      return sound;
    } catch (error) {
      console.error('[Audio] Load error:', error.message);
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
