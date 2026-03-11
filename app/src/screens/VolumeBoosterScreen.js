import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../theme/colors';
import useStore from '../store/useStore';
import { AudioPlayer } from '../services/audioPlayer';

const EQ_BANDS = [
  { key: 'bass',    label: 'Bass',     hz: '60Hz',   icon: 'radio' },
  { key: 'lowMid',  label: 'Low-Mid',  hz: '250Hz',  icon: 'radio' },
  { key: 'mid',     label: 'Mid',      hz: '1kHz',   icon: 'radio' },
  { key: 'highMid', label: 'High-Mid', hz: '4kHz',   icon: 'radio' },
  { key: 'treble',  label: 'Treble',   hz: '16kHz',  icon: 'radio' },
];

const PRESETS = [
  { name: 'Flat',       bands: { bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0 } },
  { name: 'Bass Boost', bands: { bass: 8, lowMid: 4, mid: 0, highMid: 0, treble: 0 } },
  { name: 'Treble+',    bands: { bass: 0, lowMid: 0, mid: 0, highMid: 4, treble: 8 } },
  { name: 'Vocal',      bands: { bass: -2, lowMid: 2, mid: 6, highMid: 4, treble: 1 } },
  { name: 'Rock',       bands: { bass: 5, lowMid: 2, mid: -1, highMid: 3, treble: 4 } },
  { name: 'Pop',        bands: { bass: 2, lowMid: 1, mid: 3, highMid: 4, treble: 2 } },
];

function getVolumeColor(vol) {
  if (vol <= 0.7) return COLORS.primary;
  if (vol <= 1.0) return COLORS.warning;
  return COLORS.error;
}

function getVolumeLabel(vol) {
  const pct = Math.round(vol * 100);
  if (pct > 100) return `${pct}% (Boosted)`;
  return `${pct}%`;
}

export default function VolumeBoosterScreen() {
  const navigation = useNavigation();
  const { volume, setVolume, equalizerBands, setEqualizerBand } = useStore();
  const [activePreset, setActivePreset] = useState('Flat');

  const handleVolumeChange = async (val) => {
    setVolume(val);
    // Clamp to 1.0 for expo-av; visually show boost
    await AudioPlayer.setVolume(Math.min(val, 1.0));
  };

  const applyPreset = (preset) => {
    setActivePreset(preset.name);
    Object.entries(preset.bands).forEach(([key, val]) => setEqualizerBand(key, val));
  };

  const resetAll = () => {
    applyPreset(PRESETS[0]);
    handleVolumeChange(1.0);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1a3a', '#121212']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-down" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Volume & Equalizer</Text>
        <TouchableOpacity onPress={resetAll}>
          <Text style={styles.resetText}>Reset</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Volume Booster */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="volume-high" size={22} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Volume Booster</Text>
            <Text style={[styles.volLabel, { color: getVolumeColor(volume) }]}>
              {getVolumeLabel(volume)}
            </Text>
          </View>

          {volume > 1.0 && (
            <View style={styles.boostWarning}>
              <Ionicons name="warning" size={14} color={COLORS.warning} />
              <Text style={styles.boostWarningText}>Boosted — may affect audio quality</Text>
            </View>
          )}

          <Slider
            style={styles.volSlider}
            minimumValue={0}
            maximumValue={1.5}
            step={0.01}
            value={volume}
            minimumTrackTintColor={getVolumeColor(volume)}
            maximumTrackTintColor={COLORS.progressBg}
            thumbTintColor={getVolumeColor(volume)}
            onValueChange={handleVolumeChange}
          />

          <View style={styles.volMarkers}>
            <Text style={styles.volMarker}>0%</Text>
            <Text style={[styles.volMarker, { color: COLORS.primary }]}>100%</Text>
            <Text style={[styles.volMarker, { color: COLORS.error }]}>150%</Text>
          </View>

          {/* Quick volume buttons */}
          <View style={styles.quickVols}>
            {[0.25, 0.5, 0.75, 1.0, 1.25, 1.5].map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.quickVolBtn, Math.abs(volume - v) < 0.05 && styles.quickVolBtnActive]}
                onPress={() => handleVolumeChange(v)}
              >
                <Text style={[
                  styles.quickVolText,
                  Math.abs(volume - v) < 0.05 && styles.quickVolTextActive,
                ]}>
                  {Math.round(v * 100)}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* EQ Presets */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="options" size={22} color={COLORS.primary} />
            <Text style={styles.cardTitle}>EQ Presets</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsRow}>
            {PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.name}
                style={[styles.presetBtn, activePreset === preset.name && styles.presetBtnActive]}
                onPress={() => applyPreset(preset)}
              >
                <Text style={[styles.presetText, activePreset === preset.name && styles.presetTextActive]}>
                  {preset.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* EQ Bands */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="bar-chart" size={22} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Equalizer</Text>
          </View>

          {/* EQ Visualizer bars */}
          <View style={styles.eqVisualizer}>
            {EQ_BANDS.map((band) => {
              const val = equalizerBands[band.key];
              const height = Math.abs(val) * 4 + 8;
              const positive = val >= 0;
              return (
                <View key={band.key} style={styles.eqBarContainer}>
                  <View style={[
                    styles.eqBar,
                    { height, backgroundColor: positive ? COLORS.primary : COLORS.error }
                  ]} />
                </View>
              );
            })}
          </View>

          {/* Band Sliders */}
          {EQ_BANDS.map((band) => (
            <View key={band.key} style={styles.bandRow}>
              <View style={styles.bandLabel}>
                <Text style={styles.bandName}>{band.label}</Text>
                <Text style={styles.bandHz}>{band.hz}</Text>
              </View>
              <Slider
                style={styles.bandSlider}
                minimumValue={-10}
                maximumValue={10}
                step={0.5}
                value={equalizerBands[band.key]}
                minimumTrackTintColor={COLORS.primary}
                maximumTrackTintColor={COLORS.progressBg}
                thumbTintColor={COLORS.primary}
                onValueChange={(val) => {
                  setEqualizerBand(band.key, val);
                  setActivePreset('Custom');
                }}
              />
              <Text style={styles.bandValue}>
                {equalizerBands[band.key] > 0 ? '+' : ''}{equalizerBands[band.key].toFixed(1)} dB
              </Text>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 16,
  },
  headerTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  resetText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  scroll: { paddingHorizontal: 16, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 16,
    marginBottom: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', flex: 1 },
  volLabel: { fontSize: 14, fontWeight: '700' },
  boostWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,164,43,0.15)', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8,
  },
  boostWarningText: { color: COLORS.warning, fontSize: 12 },
  volSlider: { width: '100%', height: 44 },
  volMarkers: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -8 },
  volMarker: { color: COLORS.textMuted, fontSize: 11 },
  quickVols: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  quickVolBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  quickVolBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  quickVolText: { color: COLORS.textSecondary, fontSize: 13 },
  quickVolTextActive: { color: '#000', fontWeight: '700' },
  presetsRow: { flexDirection: 'row' },
  presetBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, marginRight: 8,
  },
  presetBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  presetText: { color: COLORS.textSecondary, fontSize: 13 },
  presetTextActive: { color: '#000', fontWeight: '700' },
  eqVisualizer: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end',
    height: 50, marginBottom: 16, backgroundColor: COLORS.surface, borderRadius: 8, padding: 8,
  },
  eqBarContainer: { alignItems: 'center', width: 32 },
  eqBar: { width: 20, borderRadius: 4, minHeight: 8 },
  bandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  bandLabel: { width: 72 },
  bandName: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  bandHz: { color: COLORS.textMuted, fontSize: 11 },
  bandSlider: { flex: 1, height: 40 },
  bandValue: { width: 60, color: COLORS.primary, fontSize: 12, fontWeight: '600', textAlign: 'right' },
});
