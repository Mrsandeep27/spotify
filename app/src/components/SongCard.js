import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import useStore from '../store/useStore';

export default function SongCard({ song, onPress, rightAction, showDuration = false }) {
  const { currentSong, isPlaying, isLiked } = useStore();
  if (!song) return null;
  const isCurrentSong = currentSong?.id === song.id;
  const liked = isLiked(song.id);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      {/* Thumbnail */}
      <View style={styles.thumbWrapper}>
        <Image source={{ uri: song.thumbnail || song.thumbnailSmall }} style={styles.thumbnail} />
        {isCurrentSong && (
          <View style={styles.playingOverlay}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={16} color="#fff" />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text
          style={[styles.title, isCurrentSong && styles.titleActive]}
          numberOfLines={1}
        >
          {song.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {song.artist}
          {showDuration && song.duration ? `  •  ${song.duration}` : ''}
        </Text>
      </View>

      {/* Right action or default more icon */}
      {rightAction || (
        <TouchableOpacity style={styles.moreBtn}>
          <Ionicons name="ellipsis-vertical" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8, gap: 12,
  },
  thumbWrapper: { position: 'relative' },
  thumbnail: { width: 52, height: 52, borderRadius: 4, backgroundColor: COLORS.card },
  playingOverlay: {
    ...StyleSheet.absoluteFillObject, borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center',
  },
  info: { flex: 1 },
  title: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '500' },
  titleActive: { color: COLORS.primary },
  artist: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
  moreBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
});
