import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity, Keyboard, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS } from '../theme/colors';
import useStore from '../store/useStore';
import SongCard from '../components/SongCard';
import { ENDPOINTS } from '../config/api';

const BROWSE_CATEGORIES = [
  { id: '1', name: 'Podcasts', color: '#006450', query: 'podcast episodes' },
  { id: '2', name: 'Live Events', color: '#8400E7', query: 'live concert music' },
  { id: '3', name: 'Made For You', color: '#1E3264', query: 'top hits 2024' },
  { id: '4', name: 'New Releases', color: '#E8115B', query: 'new music 2024' },
  { id: '5', name: 'Hindi', color: '#E13300', query: 'hindi songs 2024' },
  { id: '6', name: 'Punjabi', color: '#DC148C', query: 'punjabi songs 2024' },
  { id: '7', name: 'Pop', color: '#0D73EC', query: 'pop hits 2024' },
  { id: '8', name: 'Hip-Hop', color: '#BA5D07', query: 'hip hop 2024' },
  { id: '9', name: 'Rock', color: '#E91429', query: 'rock hits' },
  { id: '10', name: 'Chill', color: '#503750', query: 'chill vibes music' },
  { id: '11', name: 'Dance', color: '#1E3264', query: 'dance electronic music' },
  { id: '12', name: 'Bollywood', color: '#E8115B', query: 'bollywood hits 2024' },
  { id: '13', name: 'K-Pop', color: '#148A08', query: 'kpop 2024' },
  { id: '14', name: 'Devotional', color: '#8D67AB', query: 'devotional songs hindi' },
  { id: '15', name: 'Romantic', color: '#DC148C', query: 'romantic love songs' },
  { id: '16', name: 'Workout', color: '#777777', query: 'workout music' },
];

export default function SearchScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { setCurrentSong, setQueue } = useStore();

  const [query, setQuery] = useState(route.params?.query || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (route.params?.query) {
      setQuery(route.params.query);
      handleSearch(route.params.query);
    }
    return () => clearTimeout(debounceRef.current);
  }, [route.params?.query]);

  const handleSearch = async (q = query) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(ENDPOINTS.search(trimmed));
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setResults(data.songs || []);
    } catch (e) {
      console.warn('Search error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const onChangeText = (text) => {
    setQuery(text);
    clearTimeout(debounceRef.current);
    if (text.length === 0) {
      setResults([]);
      setSearched(false);
    } else if (text.length > 2) {
      debounceRef.current = setTimeout(() => handleSearch(text), 800);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
    inputRef.current?.focus();
  };

  const playSong = (song) => {
    setQueue(results, results.findIndex((s) => s.id === song.id));
    setCurrentSong(song);
    navigation.navigate('Player');
  };

  const showResults = searched || results.length > 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBarWrap}>
        <View style={[styles.searchBar, isFocused && styles.searchBarFocused]}>
          <Ionicons name="search" size={20} color="#000" />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="What do you want to listen to?"
            placeholderTextColor="#6A6A6A"
            value={query}
            onChangeText={onChangeText}
            onSubmitEditing={() => handleSearch()}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            returnKeyType="search"
            autoFocus={!route.params?.query}
            selectionColor={COLORS.primary}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={20} color="#6A6A6A" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : showResults ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={() =>
            results.length > 0 ? (
              <View style={styles.topResultHeader}>
                <Text style={styles.topResultLabel}>Songs</Text>
                <Text style={styles.resultCount}>{results.length} results</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={() => (
            <View style={styles.center}>
              <Ionicons name="search-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptySubtext}>Try different keywords</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <SongCard song={item} onPress={() => playSong(item)} showDuration />
          )}
        />
      ) : (
        /* Browse All Grid */
        <FlatList
          data={BROWSE_CATEGORIES}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.browseRow}
          contentContainerStyle={{ paddingBottom: 140 }}
          ListHeaderComponent={() => (
            <Text style={styles.browseTitle}>Browse all</Text>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.browseCard, { backgroundColor: item.color }]}
              onPress={() => {
                setQuery(item.name);
                handleSearch(item.query);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.browseName}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: 54, paddingHorizontal: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#fff' },

  // Search Bar
  searchBarWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 8,
    paddingHorizontal: 14, height: 48, gap: 10,
  },
  searchBarFocused: { borderWidth: 2, borderColor: COLORS.primary },
  searchInput: { flex: 1, fontSize: 15, color: '#000', fontWeight: '500' },

  // Results
  topResultHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
  },
  topResultLabel: { fontSize: 18, fontWeight: '700', color: '#fff' },
  resultCount: { color: COLORS.textSecondary, fontSize: 12 },

  // Browse Grid
  browseTitle: {
    fontSize: 16, fontWeight: '700', color: '#fff',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  browseRow: { paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  browseCard: {
    flex: 1, height: 100, borderRadius: 8,
    padding: 14, overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  browseName: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Empty / Center
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingTop: 60 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 12 },
  emptySubtext: { color: COLORS.textSecondary, fontSize: 14 },
});
