import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import useStore from '../store/useStore';

export default function SongCard({ song, onPress, rightAction, showDuration = false }) {
  const { currentSong, isPlaying } = useStore();
  if (!song) return null;
  const isActive = currentSong?.id === song.id;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.6}>
      {/* Thumbnail */}
      <View style={styles.thumbWrap}>
        <Image source={{ uri: song.thumbnailSmall || song.thumbnail }} style={styles.thumb} />
        {isActive && (
          <View style={styles.activeOverlay}>
            <Ionicons name={isPlaying ? 'volume-high' : 'play'} size={14} color={COLORS.primary} />
          </View>
        )}
      </View>

      {/* Song info */}
      <View style={styles.info}>
        <Text style={[styles.title, isActive && styles.titleActive]} numberOfLines={1}>
          {song.title}
        </Text>
        <View style={styles.metaRow}>
          {isActive && (
            <Ionicons name="musical-note" size={11} color={COLORS.primary} style={{ marginRight: 3 }} />
          )}
          <Text style={[styles.subtitle, isActive && styles.subtitleActive]} numberOfLines={1}>
            {song.artist}
            {showDuration && song.duration ? ` \u00B7 ${song.duration}` : ''}
          </Text>
        </View>
      </View>

      {/* Right action */}
      {rightAction || (
        <TouchableOpacity style={styles.moreBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="ellipsis-vertical" size={16} color={COLORS.textMuted} />
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
  thumbWrap: { position: 'relative' },
  thumb: {
    width: 48, height: 48, borderRadius: 4,
    backgroundColor: COLORS.card,
  },
  activeOverlay: {
    ...StyleSheet.absoluteFillObject, borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },
  info: { flex: 1, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 15, fontWeight: '400', lineHeight: 20 },
  titleActive: { color: COLORS.primary },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  subtitle: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 17 },
  subtitleActive: { color: COLORS.primary, opacity: 0.7 },
  moreBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
});
