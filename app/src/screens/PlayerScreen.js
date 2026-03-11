import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../theme/colors';
import useStore from '../store/useStore';
import { AudioPlayer } from '../services/audioPlayer';
import { SocketService } from '../services/socketService';

const { width } = Dimensions.get('window');
const ARTWORK_SIZE = width - 64;

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function PlayerScreen() {
  const navigation = useNavigation();
  const {
    currentSong, setCurrentSong, isPlaying, setIsPlaying,
    position, setPosition, duration, setDuration,
    volume, setVolume, isLiked, toggleLike,
    isShuffled, toggleShuffle, repeatMode, cycleRepeat,
    playNext, playPrev, session, isHost,
    queue,
  } = useStore();

  const [loading, setLoading] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const loadedSongId = useRef(null);

  // ─── Load song when it changes ───────────────────────────────────
  useEffect(() => {
    if (!currentSong || currentSong.id === loadedSongId.current) return;

    loadedSongId.current = currentSong.id;
    loadSong(currentSong);
  }, [currentSong?.id]);

  const loadSong = async (song) => {
    setLoading(true);
    setIsPlaying(false);
    try {
      await AudioPlayer.load(song, handleStatusUpdate);
      setIsPlaying(true);

      // Notify session if host
      if (session && isHost) {
        SocketService.sendSongChange(session.code, song);
      }
    } catch (e) {
      Alert.alert('Playback Error', 'Could not play this song. Try another.');
      console.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = useCallback((status) => {
    if (!status.isLoaded) return;
    if (!isSeeking) setPosition(status.positionMillis / 1000);
    setDuration(status.durationMillis / 1000);
    setIsPlaying(status.isPlaying);

    // Auto play next when song ends
    if (status.didJustFinish) {
      if (repeatMode === 'one') {
        AudioPlayer.seekTo(0);
        AudioPlayer.play();
      } else {
        const next = playNext();
        if (next) loadSong(next);
      }
    }
  }, [isSeeking, repeatMode]);

  // ─── Socket sync (session listeners) ────────────────────────────
  useEffect(() => {
    if (!session || isHost) return;

    const onSync = ({ isPlaying: playing, position: pos, song }) => {
      if (song && song.id !== currentSong?.id) {
        setCurrentSong(song);
      }
      if (playing) AudioPlayer.play();
      else AudioPlayer.pause();
      if (pos !== undefined) AudioPlayer.seekTo(pos * 1000);
    };

    const onSongChanged = ({ song }) => setCurrentSong(song);
    const onSeek = ({ position: pos }) => AudioPlayer.seekTo(pos * 1000);

    SocketService.on('playback_sync', onSync);
    SocketService.on('song_changed', onSongChanged);
    SocketService.on('seek_sync', onSeek);

    return () => {
      SocketService.off('playback_sync', onSync);
      SocketService.off('song_changed', onSongChanged);
      SocketService.off('seek_sync', onSeek);
    };
  }, [session, isHost, currentSong?.id]);

  // ─── Controls ────────────────────────────────────────────────────
  const handlePlayPause = async () => {
    await AudioPlayer.togglePlayPause();
    if (session && isHost) {
      SocketService.sendPlaybackUpdate(session.code, {
        isPlaying: !isPlaying,
        position,
        song: currentSong,
      });
    }
  };

  const handlePrev = () => {
    if (position > 3) {
      AudioPlayer.seekTo(0);
      return;
    }
    const prev = playPrev();
    if (prev) loadSong(prev);
  };

  const handleNext = () => {
    const next = playNext();
    if (next) loadSong(next);
  };

  const handleSeekStart = () => {
    setIsSeeking(true);
    setSeekValue(position);
  };

  const handleSeekChange = (value) => setSeekValue(value);

  const handleSeekEnd = async (value) => {
    setIsSeeking(false);
    setPosition(value);
    await AudioPlayer.seekTo(value * 1000);
    if (session && isHost) {
      SocketService.sendSeek(session.code, value);
    }
  };

  const handleLike = () => {
    if (!currentSong) return;
    toggleLike(currentSong);
  };

  if (!currentSong) {
    return (
      <View style={[styles.container, styles.center]}>
        <LinearGradient colors={['#1a3a2a', '#121212']} style={StyleSheet.absoluteFill} />
        <Ionicons name="musical-notes-outline" size={80} color={COLORS.textMuted} />
        <Text style={styles.noSongText}>Nothing playing</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn2}>
          <Text style={styles.backBtn2Text}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const liked = isLiked(currentSong.id);
  const progress = duration > 0 ? (isSeeking ? seekValue : position) : 0;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(29,185,84,0.3)', '#121212', '#121212']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.chevronBtn}>
          <Ionicons name="chevron-down" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel}>NOW PLAYING</Text>
          {session && (
            <Text style={styles.sessionLabel}>
              <Ionicons name="people" size={10} /> Jam Session
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.chevronBtn} onPress={() => navigation.navigate('GroupSession')}>
          <Ionicons name="people-outline" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Artwork */}
      <View style={styles.artworkContainer}>
        <Image
          source={{ uri: currentSong.thumbnail || 'https://via.placeholder.com/300' }}
          style={styles.artwork}
        />
        {loading && (
          <View style={styles.artworkOverlay}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        )}
      </View>

      {/* Song Info + Like */}
      <View style={styles.songInfo}>
        <View style={styles.songText}>
          <Text style={styles.songTitle} numberOfLines={1}>{currentSong.title}</Text>
          <Text style={styles.songArtist} numberOfLines={1}>{currentSong.artist}</Text>
        </View>
        <TouchableOpacity onPress={handleLike} style={styles.likeBtn}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={26}
            color={liked ? COLORS.primary : COLORS.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={duration || 1}
          value={progress}
          minimumTrackTintColor={COLORS.primary}
          maximumTrackTintColor={COLORS.progressBg}
          thumbTintColor={COLORS.primary}
          onSlidingStart={handleSeekStart}
          onValueChange={handleSeekChange}
          onSlidingComplete={handleSeekEnd}
          disabled={!isHost && !!session}
        />
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(isSeeking ? seekValue : position)}</Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={toggleShuffle}>
          <Ionicons
            name="shuffle"
            size={22}
            color={isShuffled ? COLORS.primary : COLORS.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={handlePrev} disabled={(!isHost && !!session)}>
          <Ionicons name="play-skip-back" size={32} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handlePlayPause}
          style={styles.playBtn}
          disabled={loading || (!isHost && !!session)}
        >
          {loading ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={30} color="#000" />
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleNext} disabled={(!isHost && !!session)}>
          <Ionicons name="play-skip-forward" size={32} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={cycleRepeat}>
          <View>
            <Ionicons
              name={repeatMode === 'one' ? 'repeat-outline' : 'repeat'}
              size={22}
              color={repeatMode !== 'none' ? COLORS.primary : COLORS.textSecondary}
            />
            {repeatMode === 'one' && (
              <Text style={styles.repeatOne}>1</Text>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('VolumeBooster')}
        >
          <Ionicons name="volume-high" size={20} color={COLORS.textSecondary} />
          <Text style={styles.actionBtnText}>Volume</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, session && styles.actionBtnActive]}
          onPress={() => navigation.navigate('GroupSession')}
        >
          <Ionicons name="people" size={20} color={session ? COLORS.primary : COLORS.textSecondary} />
          <Text style={[styles.actionBtnText, session && { color: COLORS.primary }]}>
            {session ? 'In Jam' : 'Start Jam'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="list" size={20} color={COLORS.textSecondary} />
          <Text style={styles.actionBtnText}>Queue ({queue.length})</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { justifyContent: 'center', alignItems: 'center', gap: 16 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 8,
  },
  chevronBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { alignItems: 'center' },
  headerLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  sessionLabel: { color: COLORS.primary, fontSize: 11, marginTop: 2 },
  artworkContainer: {
    alignSelf: 'center', marginTop: 16,
    width: ARTWORK_SIZE, height: ARTWORK_SIZE,
    borderRadius: 12, overflow: 'hidden',
    elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.8,
  },
  artwork: { width: '100%', height: '100%', backgroundColor: COLORS.card },
  artworkOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  songInfo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, marginTop: 28,
  },
  songText: { flex: 1, marginRight: 16 },
  songTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800' },
  songArtist: { color: COLORS.textSecondary, fontSize: 16, marginTop: 4 },
  likeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  progressContainer: { paddingHorizontal: 20, marginTop: 16 },
  slider: { width: '100%', height: 40 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -8 },
  timeText: { color: COLORS.textSecondary, fontSize: 12 },
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 28, marginTop: 16,
  },
  playBtn: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', elevation: 8,
  },
  repeatOne: { position: 'absolute', right: -6, bottom: -4, color: COLORS.primary, fontSize: 9, fontWeight: '900' },
  bottomActions: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingHorizontal: 16, marginTop: 28, paddingBottom: 24,
  },
  actionBtn: { alignItems: 'center', gap: 4 },
  actionBtnActive: {},
  actionBtnText: { color: COLORS.textSecondary, fontSize: 11 },
  noSongText: { color: COLORS.textSecondary, fontSize: 18 },
  backBtn2: { backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  backBtn2Text: { color: '#000', fontWeight: '700' },
});
