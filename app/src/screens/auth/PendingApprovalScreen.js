import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { AuthService } from '../../services/authService';

export default function PendingApprovalScreen({ email }) {
  return (
    <LinearGradient colors={['#0a1a3f', '#121212', '#121212']} style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.iconCircle}>
          <Ionicons name="time-outline" size={56} color="#FFB800" />
        </View>

        <Text style={styles.title}>Waiting for Approval</Text>
        <Text style={styles.subtitle}>
          Your account has been created and is pending admin approval. You'll be able to use Spofity once approved.
        </Text>

        {email ? (
          <View style={styles.emailBox}>
            <Ionicons name="mail-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.emailText}>{email}</Text>
          </View>
        ) : null}

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.textMuted} />
          <Text style={styles.infoText}>
            Ask the admin to approve your account. This usually happens quickly.
          </Text>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={() => AuthService.signOut()}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,184,0,0.1)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 28,
  },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  emailBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.surface, borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 16,
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 20,
  },
  emailText: { color: COLORS.textPrimary, fontSize: 14 },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10, padding: 14,
    marginBottom: 36,
  },
  infoText: { color: COLORS.textMuted, fontSize: 13, flex: 1, lineHeight: 20 },
  signOutBtn: { paddingVertical: 10, paddingHorizontal: 24 },
  signOutText: { color: COLORS.textMuted, fontSize: 14, textDecorationLine: 'underline' },
});
