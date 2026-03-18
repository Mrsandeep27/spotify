import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
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
      activeOpacity={0.95}
      onPress={() => navigation.navigate('Player')}
      style={styles.wrapper}
    >
      {/* Mini player body — Spotify style */}
      <View style={styles.body}>
        <Image source={{ uri: currentSong.thumbnailSmall || currentSong.thumbnail }} style={styles.thumb} />
        <View style={styles.info}>
          <Text style={[styles.title, isPlaying && styles.titleActive]} numberOfLines={1}>
            {currentSong.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>{currentSong.artist}</Text>
        </View>
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); AudioPlayer.togglePlayPause(); }}
          style={styles.playBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Progress bar — thin line at bottom like Spotify */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute', bottom: 58, left: 6, right: 6,
    borderRadius: 8, overflow: 'hidden',
    backgroundColor: COLORS.elevated,
    elevation: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.5, shadowRadius: 8,
  },
  body: {
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 6, paddingRight: 12,
    paddingVertical: 6, gap: 10,
  },
  thumb: {
    width: 42, height: 42, borderRadius: 4,
    backgroundColor: COLORS.card,
  },
  info: { flex: 1 },
  title: { color: '#fff', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  titleActive: { color: COLORS.primary },
  artist: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 16 },
  playBtn: {
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
  },
  progressTrack: {
    height: 2, backgroundColor: COLORS.progressBg,
  },
  progressFill: {
    height: 2, backgroundColor: COLORS.primary,
  },
});
