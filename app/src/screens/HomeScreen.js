import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, FlatList, ActivityIndicator, RefreshControl,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../theme/colors';
import useStore from '../store/useStore';
import SongCard from '../components/SongCard';
import { ENDPOINTS } from '../config/api';

const GENRE_CATEGORIES = [
  { id: '1', name: 'Pop', color: '#E13300', icon: 'musical-notes', query: 'pop hits 2024' },
  { id: '2', name: 'Hip-Hop', color: '#DC148C', icon: 'mic', query: 'hip hop 2024' },
  { id: '3', name: 'Rock', color: '#0D73EC', icon: 'flash', query: 'rock hits' },
  { id: '4', name: 'R&B', color: '#8400E7', icon: 'heart', query: 'rnb songs 2024' },
  { id: '5', name: 'Electronic', color: '#1E3264', icon: 'pulse', query: 'electronic music 2024' },
  { id: '6', name: 'Bollywood', color: '#E8115B', icon: 'star', query: 'bollywood hits 2024' },
  { id: '7', name: 'Latin', color: '#8D67AB', icon: 'sunny', query: 'latin hits 2024' },
  { id: '8', name: 'K-Pop', color: '#BA5D07', icon: 'sparkles', query: 'kpop 2024' },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user, likedSongs, setQueue, setCurrentSong } = useStore();
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeatured = useCallback(async () => {
    try {
      const res = await fetch(ENDPOINTS.featured);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setFeatured(data.songs || []);
    } catch (e) {
      console.warn('Failed to fetch featured:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchFeatured(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeatured();
  };

  const playSong = (song, list) => {
    setQueue(list, list.findIndex((s) => s.id === song.id));
    setCurrentSong(song);
    navigation.navigate('Player');
  };

  const playGenre = (category) => {
    navigation.navigate('Search', { query: category.query });
  };

  // Build quick access items (Spotify-style 2-column grid)
  const quickItems = [];
  if (likedSongs.length > 0) {
    quickItems.push({ key: 'liked', title: 'Liked Songs', icon: 'heart', gradient: ['#7B4FC4', '#4A2D8A'], onPress: () => navigation.navigate('Library') });
  }
  quickItems.push({ key: 'downloads', title: 'Downloads', icon: 'download', gradient: ['#1ED760', '#0f7a34'], onPress: () => navigation.navigate('Library', { tab: 'downloads' }) });
  // Add recent songs as quick items
  if (likedSongs.length > 0) {
    likedSongs.slice(0, 4).forEach((s, i) => {
      quickItems.push({
        key: `recent-${s.id}`,
        title: s.title,
        thumbnail: s.thumbnailSmall || s.thumbnail,
        onPress: () => playSong(s, likedSongs),
      });
    });
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Header */}
        <LinearGradient colors={['#1A3A2A', '#0A0A0A', '#000000']} style={styles.headerGradient}>
          <View style={styles.header}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <View style={styles.headerIcons}>
              <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.navigate('GroupSession')}>
                <Ionicons name="people-outline" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.navigate('VolumeBooster')}>
                <Ionicons name="settings-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Access Grid — Spotify style 2-column */}
          <View style={styles.quickGrid}>
            {quickItems.slice(0, 6).map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.quickItem}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                {item.gradient ? (
                  <LinearGradient colors={item.gradient} style={styles.quickItemIcon}>
                    <Ionicons name={item.icon} size={16} color="#fff" />
                  </LinearGradient>
                ) : (
                  <Image source={{ uri: item.thumbnail }} style={styles.quickItemThumb} />
                )}
                <Text style={styles.quickItemText} numberOfLines={1}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>

        {/* Featured / Top Hits */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular right now</Text>
          </View>
          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30, marginBottom: 30 }} />
          ) : (
            <FlatList
              data={featured}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.featuredCard}
                  onPress={() => playSong(item, featured)}
                  activeOpacity={0.7}
                >
                  <Image source={{ uri: item.thumbnail }} style={styles.featuredThumb} />
                  <Text style={styles.featuredTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.featuredArtist} numberOfLines={1}>{item.artist}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        {/* Browse by Genre */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { paddingHorizontal: 16 }]}>Browse all</Text>
          <View style={styles.genreGrid}>
            {GENRE_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.genreCard, { backgroundColor: cat.color }]}
                onPress={() => playGenre(cat)}
                activeOpacity={0.8}
              >
                <Text style={styles.genreName}>{cat.name}</Text>
                <View style={styles.genreIconWrap}>
                  <Ionicons name={cat.icon} size={38} color="rgba(255,255,255,0.15)" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Liked Songs Preview */}
        {likedSongs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your top mixes</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Library')}>
                <Text style={styles.showAll}>Show all</Text>
              </TouchableOpacity>
            </View>
            {likedSongs.slice(0, 5).map((song) => (
              <SongCard
                key={song.id}
                song={song}
                onPress={() => playSong(song, likedSongs)}
              />
            ))}
          </View>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerGradient: { paddingTop: 54, paddingBottom: 12 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 16,
  },
  greeting: { fontSize: 24, fontWeight: '700', color: '#fff' },
  headerIcons: { flexDirection: 'row', gap: 16 },
  headerIcon: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },

  // Quick Access Grid
  quickGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, gap: 8,
  },
  quickItem: {
    width: '48%', flexGrow: 1, flexBasis: '46%',
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 6, overflow: 'hidden', height: 56,
  },
  quickItemIcon: {
    width: 56, height: 56, justifyContent: 'center', alignItems: 'center',
  },
  quickItemThumb: {
    width: 56, height: 56, backgroundColor: COLORS.elevated,
  },
  quickItemText: {
    flex: 1, color: '#fff', fontSize: 13, fontWeight: '700',
    paddingHorizontal: 10,
  },

  // Sections
  section: { marginTop: 28 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 14,
  },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  showAll: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },

  // Featured Cards
  featuredCard: { width: 150, marginRight: 14 },
  featuredThumb: {
    width: 150, height: 150, borderRadius: 8,
    backgroundColor: COLORS.card,
  },
  featuredTitle: { color: '#fff', fontSize: 13, fontWeight: '600', marginTop: 8, lineHeight: 17 },
  featuredArtist: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 },

  // Genre Grid
  genreGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 8, marginTop: 4,
  },
  genreCard: {
    width: '48%', flexGrow: 1, flexBasis: '46%',
    height: 100, borderRadius: 8,
    padding: 16, overflow: 'hidden',
  },
  genreName: { color: '#fff', fontSize: 17, fontWeight: '700' },
  genreIconWrap: {
    position: 'absolute', right: -2, bottom: -2,
    transform: [{ rotate: '25deg' }],
  },
});
