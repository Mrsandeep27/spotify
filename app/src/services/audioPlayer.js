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

      // Extract stream URL client-side (phone's residential IP isn't blocked by YouTube)
      const streamUri = song.localUri || (await getStreamUrl(song.id));

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
