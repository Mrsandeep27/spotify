import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  Dimensions, ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../theme/colors';
import useStore from '../store/useStore';
import { AudioPlayer } from '../services/audioPlayer';
import { SocketService } from '../services/socketService';

const { width } = Dimensions.get('window');
const ARTWORK_SIZE = width - 48;

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
      if (session && isHost) {
        SocketService.sendSongChange(session.code, song);
      }
    } catch (e) {
      console.error('[Player] Playback error:', e.message);
      Alert.alert('Playback Error', e.message || 'Could not play this song. Try another.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = useCallback((status) => {
    if (!status.isLoaded) return;
    if (!isSeeking) setPosition(status.positionMillis / 1000);
    setDuration(status.durationMillis / 1000);
    setIsPlaying(status.isPlaying);
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

  useEffect(() => {
    if (!session || isHost) return;
    const onSync = ({ isPlaying: playing, position: pos, song }) => {
      if (song && song.id !== currentSong?.id) setCurrentSong(song);
      if (playing) AudioPlayer.play(); else AudioPlayer.pause();
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

  const handlePlayPause = async () => {
    await AudioPlayer.togglePlayPause();
    if (session && isHost) {
      SocketService.sendPlaybackUpdate(session.code, {
        isPlaying: !isPlaying, position, song: currentSong,
      });
    }
  };

  const handlePrev = () => {
    if (position > 3) { AudioPlayer.seekTo(0); return; }
    const prev = playPrev();
    if (prev) loadSong(prev);
  };

  const handleNext = () => {
    const next = playNext();
    if (next) loadSong(next);
  };

  const handleLike = () => {
    if (!currentSong) return;
    toggleLike(currentSong);
  };

  if (!currentSong) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar barStyle="light-content" />
        <Ionicons name="musical-notes-outline" size={64} color={COLORS.textMuted} />
        <Text style={styles.noSongText}>Nothing playing</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackBtn}>
          <Text style={styles.goBackText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const liked = isLiked(currentSong.id);
  const progress = duration > 0 ? (isSeeking ? seekValue : position) : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#535353', '#121212', '#000000']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="chevron-down" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerSub}>PLAYING FROM</Text>
          <Text style={styles.headerFrom} numberOfLines={1}>
            {session ? 'Jam Session' : 'Search'}
          </Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('GroupSession')}>
          <Ionicons name="ellipsis-horizontal" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Artwork */}
      <View style={styles.artworkWrap}>
        <Image
          source={{ uri: currentSong.thumbnail }}
          style={styles.artwork}
        />
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        )}
      </View>

      {/* Song Info + Like */}
      <View style={styles.songRow}>
        <View style={styles.songInfo}>
          <Text style={styles.songTitle} numberOfLines={1}>{currentSong.title}</Text>
          <Text style={styles.songArtist} numberOfLines={1}>{currentSong.artist}</Text>
        </View>
        <TouchableOpacity onPress={handleLike} style={styles.likeBtn}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={24}
            color={liked ? COLORS.primary : COLORS.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Progress */}
      <View style={styles.progressWrap}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={duration || 1}
          value={progress}
          minimumTrackTintColor="#fff"
          maximumTrackTintColor={COLORS.progressBg}
          thumbTintColor="#fff"
          onSlidingStart={() => { setIsSeeking(true); setSeekValue(position); }}
          onValueChange={(v) => setSeekValue(v)}
          onSlidingComplete={(v) => {
            setIsSeeking(false); setPosition(v);
            AudioPlayer.seekTo(v * 1000);
            if (session && isHost) SocketService.sendSeek(session.code, v);
          }}
          disabled={!isHost && !!session}
        />
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(isSeeking ? seekValue : position)}</Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={toggleShuffle} style={styles.sideControl}>
          <Ionicons name="shuffle" size={24} color={isShuffled ? COLORS.primary : COLORS.textSecondary} />
          {isShuffled && <View style={styles.activeDot} />}
        </TouchableOpacity>

        <TouchableOpacity onPress={handlePrev} disabled={!isHost && !!session}>
          <Ionicons name="play-skip-back" size={30} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handlePlayPause}
          style={styles.playBtn}
          disabled={loading || (!isHost && !!session)}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color="#000" />
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleNext} disabled={!isHost && !!session}>
          <Ionicons name="play-skip-forward" size={30} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity onPress={cycleRepeat} style={styles.sideControl}>
          <Ionicons
            name="repeat"
            size={24}
            color={repeatMode !== 'none' ? COLORS.primary : COLORS.textSecondary}
          />
          {repeatMode === 'one' && <Text style={styles.repeatBadge}>1</Text>}
          {repeatMode !== 'none' && <View style={styles.activeDot} />}
        </TouchableOpacity>
      </View>

      {/* Bottom row */}
      <View style={styles.bottomRow}>
        <TouchableOpacity onPress={() => navigation.navigate('VolumeBooster')}>
          <Ionicons name="phone-portrait-outline" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('GroupSession')}>
          <Ionicons name="share-social-outline" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="list-outline" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { justifyContent: 'center', alignItems: 'center', gap: 16 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12,
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerSub: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  headerFrom: { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 1 },

  // Artwork
  artworkWrap: {
    alignSelf: 'center', marginTop: 8,
    width: ARTWORK_SIZE, height: ARTWORK_SIZE,
    borderRadius: 8, overflow: 'hidden',
    elevation: 24, shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.6, shadowRadius: 16,
  },
  artwork: { width: '100%', height: '100%', backgroundColor: COLORS.card },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Song info
  songRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, marginTop: 24, gap: 12,
  },
  songInfo: { flex: 1 },
  songTitle: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 26 },
  songArtist: { color: COLORS.textSecondary, fontSize: 15, marginTop: 4 },
  likeBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

  // Progress
  progressWrap: { paddingHorizontal: 20, marginTop: 20 },
  slider: { width: '100%', height: 32 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  timeText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '500' },

  // Controls
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, marginTop: 16,
  },
  sideControl: { alignItems: 'center', width: 36 },
  activeDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: COLORS.primary, marginTop: 4,
  },
  playBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
  },
  repeatBadge: {
    position: 'absolute', top: -2, right: -2,
    color: COLORS.primary, fontSize: 8, fontWeight: '900',
  },

  // Bottom
  bottomRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 32, marginTop: 28, paddingBottom: 32,
  },

  // Empty state
  noSongText: { color: COLORS.textSecondary, fontSize: 16 },
  goBackBtn: {
    backgroundColor: '#fff', borderRadius: 24,
    paddingHorizontal: 24, paddingVertical: 10,
  },
  goBackText: { color: '#000', fontWeight: '700', fontSize: 14 },
});
