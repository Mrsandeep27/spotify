import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS } from '../theme/colors';
import useStore from '../store/useStore';
import SongCard from '../components/SongCard';
import { ENDPOINTS } from '../config/api';

export default function SearchScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { setCurrentSong, setQueue } = useStore();

  const [query, setQuery] = useState(route.params?.query || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (route.params?.query) {
      handleSearch(route.params.query);
    }
  }, [route.params?.query]);

  const handleSearch = async (q = query) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(ENDPOINTS.search(trimmed));
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
    if (text.length > 2) {
      debounceRef.current = setTimeout(() => handleSearch(text), 600);
    }
  };

  const playSong = (song) => {
    setQueue(results, results.findIndex((s) => s.id === song.id));
    setCurrentSong(song);
    navigation.navigate('Player');
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.inputWrapper}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Songs, artists, or albums"
            placeholderTextColor={COLORS.textMuted}
            value={query}
            onChangeText={onChangeText}
            onSubmitEditing={() => handleSearch()}
            returnKeyType="search"
            autoFocus={!route.params?.query}
            selectionColor={COLORS.primary}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 140 }}
          ListHeaderComponent={() => (
            <Text style={styles.resultsCount}>{results.length} results</Text>
          )}
          renderItem={({ item }) => (
            <SongCard
              song={item}
              onPress={() => playSong(item)}
              showDuration
            />
          )}
        />
      ) : searched ? (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No results for "{query}"</Text>
          <Text style={styles.emptySubText}>Check spelling or try different keywords</Text>
        </View>
      ) : (
        <View style={styles.center}>
          <Ionicons name="search" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>Search for any song</Text>
          <Text style={styles.emptySubText}>Find songs, artists, albums</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: COLORS.background,
  },
  backBtn: { marginRight: 10 },
  inputWrapper: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.elevated, borderRadius: 8,
    paddingHorizontal: 12, height: 44,
  },
  searchIcon: { marginRight: 8 },
  input: { flex: 1, color: COLORS.textPrimary, fontSize: 15 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyText: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 12 },
  emptySubText: { color: COLORS.textSecondary, fontSize: 14 },
  resultsCount: { color: COLORS.textSecondary, fontSize: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
});
