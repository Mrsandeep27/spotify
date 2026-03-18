import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Image, Alert, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import { COLORS } from '../theme/colors';
import useStore from '../store/useStore';
import SongCard from '../components/SongCard';
import { getStreamUrl } from '../services/youtubeExtractor';

export default function LibraryScreen() {
  const navigation = useNavigation();
  const { likedSongs, downloadedSongs, setCurrentSong, setQueue,
    removeDownloadedSong, addDownloadedSong, isDownloaded } = useStore();

  const [activeTab, setActiveTab] = useState('liked');
  const [downloading, setDownloading] = useState({});

  const songs = activeTab === 'liked' ? likedSongs : downloadedSongs;

  const playSong = (song) => {
    const actualSong = activeTab === 'downloads'
      ? { ...song, localUri: song.localUri }
      : song;
    setQueue(songs, songs.findIndex((s) => s.id === song.id));
    setCurrentSong(actualSong);
    navigation.navigate('Player');
  };

  const downloadSong = async (song) => {
    if (isDownloaded(song.id)) {
      Alert.alert(
        'Remove Download',
        `Remove "${song.title}" from downloads?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove', style: 'destructive', onPress: async () => {
              const path = `${FileSystem.documentDirectory}songs/${song.id}.mp3`;
              await FileSystem.deleteAsync(path, { idempotent: true });
              removeDownloadedSong(song.id);
            }
          },
        ]
      );
      return;
    }

    setDownloading((prev) => ({ ...prev, [song.id]: 0 }));

    try {
      const dir = `${FileSystem.documentDirectory}songs/`;
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

      const dest = `${dir}${song.id}.mp3`;

      // Get stream URL client-side (same as playback)
      const streamUrl = await getStreamUrl(song.id);
      if (!streamUrl) throw new Error('No stream URL available');

      const dl = FileSystem.createDownloadResumable(
        streamUrl, dest, {},
        (prog) => {
          const pct = Math.round((prog.totalBytesWritten / prog.totalBytesExpectedToWrite) * 100);
          setDownloading((prev) => ({ ...prev, [song.id]: pct }));
        }
      );

      await dl.downloadAsync();

      addDownloadedSong({ ...song, localUri: dest });
      Alert.alert('Downloaded', `"${song.title}" saved to device`);
    } catch (e) {
      Alert.alert('Download failed', e.message);
    } finally {
      setDownloading((prev) => { const n = { ...prev }; delete n[song.id]; return n; });
    }
  };

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Ionicons
        name={activeTab === 'liked' ? 'heart-outline' : 'download-outline'}
        size={64} color={COLORS.textMuted}
      />
      <Text style={styles.emptyTitle}>
        {activeTab === 'liked' ? 'Songs you like will appear here' : 'Download songs to listen offline'}
      </Text>
      <Text style={styles.emptySub}>
        {activeTab === 'liked'
          ? 'Save songs by tapping the heart icon'
          : 'Tap the download icon on any song'}
      </Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Search')}>
        <Text style={styles.emptyBtnText}>Find songs</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Your Library</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('Search')}>
            <Ionicons name="search-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Chips — Spotify style */}
      <View style={styles.chips}>
        <TouchableOpacity
          style={[styles.chip, activeTab === 'liked' && styles.chipActive]}
          onPress={() => setActiveTab('liked')}
        >
          <Text style={[styles.chipText, activeTab === 'liked' && styles.chipTextActive]}>
            Liked Songs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, activeTab === 'downloads' && styles.chipActive]}
          onPress={() => setActiveTab('downloads')}
        >
          <Text style={[styles.chipText, activeTab === 'downloads' && styles.chipTextActive]}>
            Downloads
          </Text>
        </TouchableOpacity>
      </View>

      {/* Liked Songs Banner */}
      {activeTab === 'liked' && likedSongs.length > 0 && (
        <TouchableOpacity
          onPress={() => playSong(likedSongs[0])}
          style={styles.banner}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#4A17C8', '#7B4FC4', '#C277E0']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.bannerGradient}
          >
            <Ionicons name="heart" size={28} color="#fff" />
            <View style={styles.bannerInfo}>
              <Text style={styles.bannerTitle}>Liked Songs</Text>
              <Text style={styles.bannerCount}>{likedSongs.length} songs</Text>
            </View>
            <View style={styles.bannerPlayBtn}>
              <Ionicons name="play" size={22} color="#000" />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Song List */}
      <FlatList
        data={songs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 140 }}
        ListEmptyComponent={renderEmpty}
        renderItem={({ item }) => (
          <SongCard
            song={item}
            onPress={() => playSong(item)}
            rightAction={
              <TouchableOpacity onPress={() => downloadSong(item)} style={styles.dlBtn}>
                {downloading[item.id] !== undefined ? (
                  <Text style={styles.dlPct}>{downloading[item.id]}%</Text>
                ) : (
                  <Ionicons
                    name={isDownloaded(item.id) ? 'checkmark-circle' : 'arrow-down-circle-outline'}
                    size={22}
                    color={isDownloaded(item.id) ? COLORS.primary : COLORS.textSecondary}
                  />
                )}
              </TouchableOpacity>
            }
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 54, paddingHorizontal: 16, paddingBottom: 8,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#fff' },
  headerRight: { flexDirection: 'row', gap: 16 },
  headerIconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },

  // Filter Chips
  chips: {
    flexDirection: 'row', paddingHorizontal: 16,
    gap: 8, marginTop: 8, marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.elevated,
  },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#000', fontWeight: '700' },

  // Banner
  banner: { marginHorizontal: 16, borderRadius: 8, overflow: 'hidden', marginBottom: 8 },
  bannerGradient: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16, gap: 14,
  },
  bannerInfo: { flex: 1 },
  bannerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  bannerCount: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  bannerPlayBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },

  // Empty
  empty: {
    alignItems: 'center', justifyContent: 'center',
    paddingTop: 80, paddingHorizontal: 32, gap: 8,
  },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center', marginTop: 12 },
  emptySub: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center' },
  emptyBtn: {
    backgroundColor: '#fff', borderRadius: 24,
    paddingHorizontal: 28, paddingVertical: 12, marginTop: 16,
  },
  emptyBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },

  // Download
  dlBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  dlPct: { color: COLORS.primary, fontSize: 11, fontWeight: '700' },
});
