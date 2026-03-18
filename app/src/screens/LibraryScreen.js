import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Image, Alert,
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

  const [activeTab, setActiveTab] = useState('liked'); // 'liked' | 'downloads'
  const [downloading, setDownloading] = useState({});

  const songs = activeTab === 'liked' ? likedSongs : downloadedSongs;

  const playSong = (song) => {
    // For downloads, use local URI if available
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
        size={80} color={COLORS.textMuted}
      />
      <Text style={styles.emptyTitle}>
        {activeTab === 'liked' ? 'No liked songs yet' : 'No downloads yet'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'liked'
          ? 'Heart songs while listening to add them here'
          : 'Download songs to listen offline'}
      </Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Search')}>
        <Text style={styles.emptyBtnText}>Find songs</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Library</Text>
        <TouchableOpacity style={styles.searchBtn} onPress={() => navigation.navigate('Search')}>
          <Ionicons name="search" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'liked' && styles.activeTab]}
          onPress={() => setActiveTab('liked')}
        >
          <Ionicons name="heart" size={14} color={activeTab === 'liked' ? '#000' : COLORS.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'liked' && styles.activeTabText]}>
            Liked ({likedSongs.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'downloads' && styles.activeTab]}
          onPress={() => setActiveTab('downloads')}
        >
          <Ionicons name="download" size={14} color={activeTab === 'downloads' ? '#000' : COLORS.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'downloads' && styles.activeTabText]}>
            Downloads ({downloadedSongs.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Liked Songs Banner */}
      {activeTab === 'liked' && likedSongs.length > 0 && (
        <TouchableOpacity onPress={() => playSong(likedSongs[0])} style={styles.banner}>
          <LinearGradient colors={['#9B59B6', '#6C3483']} style={styles.bannerGradient}>
            <Ionicons name="heart" size={40} color="#fff" />
            <View style={styles.bannerInfo}>
              <Text style={styles.bannerTitle}>Liked Songs</Text>
              <Text style={styles.bannerSub}>{likedSongs.length} songs</Text>
            </View>
            <TouchableOpacity style={styles.bannerPlay}>
              <Ionicons name="play-circle" size={48} color={COLORS.primary} />
            </TouchableOpacity>
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
                    name={isDownloaded(item.id) ? 'checkmark-circle' : 'download-outline'}
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
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16,
  },
  headerTitle: { fontSize: 24, fontWeight: '900', color: COLORS.textPrimary },
  searchBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.surface,
  },
  activeTab: { backgroundColor: COLORS.primary },
  tabText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  activeTabText: { color: '#000', fontWeight: '700' },
  banner: { marginHorizontal: 16, borderRadius: 12, overflow: 'hidden', marginBottom: 8 },
  bannerGradient: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
  bannerInfo: { flex: 1 },
  bannerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  bannerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  bannerPlay: {},
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  emptySubtitle: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  emptyBtn: { backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10, marginTop: 8 },
  emptyBtnText: { color: '#000', fontWeight: '700' },
  dlBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  dlPct: { color: COLORS.primary, fontSize: 11, fontWeight: '700' },
});
