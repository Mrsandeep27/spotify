import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../theme/colors';
import useStore from '../store/useStore';
import SongCard from '../components/SongCard';
import { ENDPOINTS } from '../config/api';

const GENRE_CATEGORIES = [
  { id: '1', name: 'Pop', color: '#E13300', query: 'pop hits 2024' },
  { id: '2', name: 'Hip-Hop', color: '#DC148C', query: 'hip hop 2024' },
  { id: '3', name: 'Rock', color: '#0D73EC', query: 'rock hits' },
  { id: '4', name: 'R&B', color: '#8400E7', query: 'rnb songs 2024' },
  { id: '5', name: 'Electronic', color: '#1E3264', query: 'electronic music 2024' },
  { id: '6', name: 'Bollywood', color: '#E8115B', query: 'bollywood hits 2024' },
  { id: '7', name: 'Latin', color: '#8D67AB', query: 'latin hits 2024' },
  { id: '8', name: 'K-Pop', color: '#BA5D07', query: 'kpop 2024' },
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

  const playGenre = async (category) => {
    navigation.navigate('Search', { query: category.query });
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      <LinearGradient colors={['#1a3a2a', '#121212']} style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('VolumeBooster')}>
              <Ionicons name="volume-high" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('GroupSession')}>
              <Ionicons name="people-outline" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick access row */}
        {likedSongs.length > 0 && (
          <View style={styles.quickRow}>
            <TouchableOpacity
              style={styles.quickItem}
              onPress={() => navigation.navigate('Library')}
            >
              <LinearGradient colors={['#9B59B6', '#6C3483']} style={styles.quickIcon}>
                <Ionicons name="heart" size={18} color="#fff" />
              </LinearGradient>
              <Text style={styles.quickText} numberOfLines={1}>Liked Songs</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickItem}
              onPress={() => navigation.navigate('Library', { tab: 'downloads' })}
            >
              <LinearGradient colors={['#1DB954', '#0f7a34']} style={styles.quickIcon}>
                <Ionicons name="download" size={18} color="#fff" />
              </LinearGradient>
              <Text style={styles.quickText} numberOfLines={1}>Downloads</Text>
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>

      {/* Featured / Top Hits */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top Hits Right Now</Text>
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={featured}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.featuredCard}
                onPress={() => playSong(item, featured)}
              >
                <Image source={{ uri: item.thumbnail }} style={styles.featuredThumbnail} />
                <Text style={styles.featuredTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.featuredArtist} numberOfLines={1}>{item.artist}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* Genre Categories */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Browse by Genre</Text>
        <View style={styles.genreGrid}>
          {GENRE_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.genreCard, { backgroundColor: cat.color }]}
              onPress={() => playGenre(cat)}
            >
              <Text style={styles.genreText}>{cat.name}</Text>
              <Ionicons name="musical-note" size={40} color="rgba(255,255,255,0.2)" style={styles.genreIcon} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Liked Songs Preview */}
      {likedSongs.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Liked Songs</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Library')}>
              <Text style={styles.seeAll}>See all</Text>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  headerIcons: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center' },
  quickRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  quickItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.elevated, borderRadius: 4, overflow: 'hidden', flex: 1, minWidth: '45%' },
  quickIcon: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  quickText: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 13, paddingHorizontal: 10, flex: 1 },
  section: { paddingHorizontal: 16, marginTop: 28 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 16 },
  seeAll: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  horizontalList: { paddingRight: 16 },
  featuredCard: { width: 140, marginRight: 12 },
  featuredThumbnail: { width: 140, height: 140, borderRadius: 8, backgroundColor: COLORS.card },
  featuredTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600', marginTop: 8 },
  featuredArtist: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  genreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  genreCard: { width: '48%', height: 80, borderRadius: 8, padding: 14, overflow: 'hidden', justifyContent: 'flex-end' },
  genreText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  genreIcon: { position: 'absolute', right: -5, bottom: -5 },
});
