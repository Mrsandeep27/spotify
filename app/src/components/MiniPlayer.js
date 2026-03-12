import React from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Platform } from 'react-native';
let BlurView;
try {
  BlurView = require('expo-blur').BlurView;
} catch (e) {
  BlurView = null;
}
import { COLORS } from '../theme/colors';
import useStore from '../store/useStore';
import { AudioPlayer } from '../services/audioPlayer';

export default function MiniPlayer() {
  const navigation = useNavigation();
  const { currentSong, isPlaying, position, duration } = useStore();

  if (!currentSong) return null;

  const progress = duration > 0 ? position / duration : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => navigation.navigate('Player')}
      style={styles.wrapper}
    >
      {BlurView && Platform.OS === 'ios' ? (
        <BlurView intensity={80} tint="dark" style={styles.blur}>
          <View style={styles.progressBar}>
            <View style={[styles.progress, { width: `${progress * 100}%` }]} />
          </View>
          <View style={styles.content}>
            <Image source={{ uri: currentSong.thumbnail }} style={styles.thumbnail} />
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>{currentSong.title}</Text>
              <Text style={styles.artist} numberOfLines={1}>{currentSong.artist}</Text>
            </View>
            <View style={styles.controls}>
              <TouchableOpacity onPress={() => AudioPlayer.togglePlayPause()} style={styles.btn}>
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn}>
                <Ionicons name="play-skip-forward" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      ) : (
        <View style={[styles.blur, { backgroundColor: 'rgba(30,30,30,0.95)' }]}>
          <View style={styles.progressBar}>
            <View style={[styles.progress, { width: `${progress * 100}%` }]} />
          </View>
          <View style={styles.content}>
            <Image source={{ uri: currentSong.thumbnail }} style={styles.thumbnail} />
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>{currentSong.title}</Text>
              <Text style={styles.artist} numberOfLines={1}>{currentSong.artist}</Text>
            </View>
            <View style={styles.controls}>
              <TouchableOpacity onPress={() => AudioPlayer.togglePlayPause()} style={styles.btn}>
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn}>
                <Ionicons name="play-skip-forward" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute', bottom: 60, left: 8, right: 8,
    borderRadius: 12, overflow: 'hidden', elevation: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4,
  },
  blur: { borderRadius: 12, overflow: 'hidden' },
  progressBar: { height: 2, backgroundColor: COLORS.elevated },
  progress: { height: 2, backgroundColor: COLORS.primary },
  content: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, gap: 12,
    backgroundColor: 'rgba(30,30,30,0.85)',
  },
  thumbnail: { width: 44, height: 44, borderRadius: 6, backgroundColor: COLORS.card },
  info: { flex: 1 },
  title: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  artist: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  btn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
});
