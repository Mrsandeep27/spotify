import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, FlatList, ActivityIndicator, Share, Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../theme/colors';
import useStore from '../store/useStore';
import { SocketService } from '../services/socketService';
import { ENDPOINTS } from '../config/api';

export default function GroupSessionScreen() {
  const navigation = useNavigation();
  const { user, session, isHost, setSession, clearSession, currentSong } = useStore();

  const [mode, setMode] = useState('home');  // 'home' | 'join' | 'active'
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState(session?.members || []);
  const [copied, setCopied] = useState(false);

  // Set mode based on existing session
  useEffect(() => {
    if (session) setMode('active');
  }, []);

  // Socket listeners for session events
  useEffect(() => {
    if (!session) return;

    const onMembersUpdate = (updatedMembers) => setMembers(updatedMembers);
    const onMemberJoined = ({ displayName }) => {
      Alert.alert('', `${displayName} joined the Jam`);
    };
    const onSessionEnded = ({ message }) => {
      Alert.alert('Session Ended', message || 'The host ended the session');
      clearSession();
      setMode('home');
      SocketService.disconnect();
    };

    SocketService.on('members_updated', onMembersUpdate);
    SocketService.on('member_joined', onMemberJoined);
    SocketService.on('session_ended', onSessionEnded);

    return () => {
      SocketService.off('members_updated', onMembersUpdate);
      SocketService.off('member_joined', onMemberJoined);
      SocketService.off('session_ended', onSessionEnded);
    };
  }, [session]);

  // ─── Create Session ───────────────────────────────────────────────
  const createSession = async () => {
    if (!user) { Alert.alert('Error', 'Please log in first'); return; }
    setLoading(true);
    try {
      const res = await fetch(ENDPOINTS.createSession, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, displayName: user.displayName || 'Host' }),
      });
      const data = await res.json();
      if (!data.code) throw new Error('Failed to create session');

      setSession(data.session, true);
      setMembers(data.session.members);

      // Connect socket and join own room
      SocketService.joinSession(data.code, user.uid, user.displayName || 'Host');

      setMode('active');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Join Session ─────────────────────────────────────────────────
  const joinSession = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) { Alert.alert('Error', 'Enter a valid session code'); return; }
    if (!user) { Alert.alert('Error', 'Please log in first'); return; }

    setLoading(true);
    try {
      // Verify session exists
      const res = await fetch(ENDPOINTS.getSession(code));
      if (!res.ok) throw new Error('Session not found. Check the code and try again.');
      const data = await res.json();

      setSession(data.session, false);
      setMembers(data.session.members);

      // Connect socket
      SocketService.connect();
      SocketService.joinSession(code, user.uid, user.displayName || 'Listener');

      // Listen for initial state
      SocketService.on('session_joined', ({ session: s, currentSong: song, isPlaying: playing, position: pos }) => {
        setMembers(s.members);
        // Will be handled by PlayerScreen socket listeners
      });

      setMode('active');
    } catch (e) {
      Alert.alert('Cannot join', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Leave Session ────────────────────────────────────────────────
  const leaveOrEndSession = () => {
    Alert.alert(
      isHost ? 'End Jam Session?' : 'Leave Jam Session?',
      isHost
        ? 'This will end the session for everyone.'
        : 'You will stop syncing with the group.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isHost ? 'End Session' : 'Leave',
          style: 'destructive',
          onPress: () => {
            if (session) {
              SocketService.leaveSession(session.code, user?.uid);
              SocketService.disconnect();
            }
            clearSession();
            setMode('home');
          },
        },
      ]
    );
  };

  const copyCode = () => {
    if (!session) return;
    Clipboard.setString(session.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareCode = async () => {
    if (!session) return;
    await Share.share({
      message: `Join my Spofity Jam! Code: ${session.code}\nPaste it in the app to sync music together 🎵`,
    });
  };

  // ─── Render ───────────────────────────────────────────────────────

  if (mode === 'active' && session) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#1a2a3a', '#121212']} style={StyleSheet.absoluteFill} />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-down" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Jam Session</Text>
          <TouchableOpacity onPress={leaveOrEndSession}>
            <Text style={styles.leaveText}>{isHost ? 'End' : 'Leave'}</Text>
          </TouchableOpacity>
        </View>

        {/* Session Code */}
        <View style={styles.codeSection}>
          <Text style={styles.codeSectionLabel}>SESSION CODE</Text>
          <View style={styles.codeBox}>
            {session.code.split('').map((char, i) => (
              <View key={i} style={styles.codeChar}>
                <Text style={styles.codeCharText}>{char}</Text>
              </View>
            ))}
          </View>
          <View style={styles.codeActions}>
            <TouchableOpacity style={styles.codeBtn} onPress={copyCode}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={copied ? COLORS.primary : COLORS.textPrimary} />
              <Text style={[styles.codeBtnText, copied && { color: COLORS.primary }]}>
                {copied ? 'Copied!' : 'Copy'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.codeBtn} onPress={shareCode}>
              <Ionicons name="share-outline" size={18} color={COLORS.textPrimary} />
              <Text style={styles.codeBtnText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Now Playing */}
        {currentSong && (
          <View style={styles.nowPlaying}>
            <Ionicons name="musical-notes" size={16} color={COLORS.primary} />
            <Text style={styles.nowPlayingText} numberOfLines={1}>
              {currentSong.title} — {currentSong.artist}
            </Text>
          </View>
        )}

        {/* Role indicator */}
        <View style={styles.roleRow}>
          <View style={[styles.roleBadge, isHost && styles.roleBadgeHost]}>
            <Ionicons name={isHost ? 'mic' : 'headset'} size={14} color={isHost ? '#000' : COLORS.textPrimary} />
            <Text style={[styles.roleText, isHost && styles.roleTextHost]}>
              {isHost ? 'You are the Host' : 'Listener — Host controls playback'}
            </Text>
          </View>
        </View>

        {/* Members List */}
        <View style={styles.membersSection}>
          <Text style={styles.membersSectionTitle}>
            {members.length} {members.length === 1 ? 'person' : 'people'} in this Jam
          </Text>
          <FlatList
            data={members}
            keyExtractor={(item) => item.userId}
            renderItem={({ item }) => (
              <View style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {(item.displayName || '?')[0].toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.memberName}>{item.displayName}</Text>
                {item.isHost && (
                  <View style={styles.hostBadge}>
                    <Text style={styles.hostBadgeText}>Host</Text>
                  </View>
                )}
              </View>
            )}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a2a3a', '#121212']} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-down" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Jam Session</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.body}>
        {/* Icon */}
        <View style={styles.jamIcon}>
          <Ionicons name="people" size={60} color={COLORS.primary} />
        </View>
        <Text style={styles.jamTitle}>Listen Together</Text>
        <Text style={styles.jamSubtitle}>
          Start a Jam and invite friends. Everyone hears the same song at the same time.
        </Text>

        {/* Start Jam */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={createSession}
          disabled={loading}
        >
          {loading && mode !== 'join' ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={20} color="#000" />
              <Text style={styles.primaryBtnText}>Start a Jam</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or join with a code</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Join Jam */}
        {mode === 'join' ? (
          <View style={styles.joinBox}>
            <TextInput
              style={styles.codeInput}
              placeholder="Enter 6-character code"
              placeholderTextColor={COLORS.textMuted}
              value={joinCode}
              onChangeText={(t) => setJoinCode(t.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
              autoFocus
              selectionColor={COLORS.primary}
            />
            <View style={styles.joinBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setMode('home')}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.joinBtn, loading && styles.btnDisabled]}
                onPress={joinSession}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#000" size="small" /> : (
                  <Text style={styles.joinBtnText}>Join</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setMode('join')}
          >
            <Ionicons name="enter-outline" size={20} color={COLORS.textPrimary} />
            <Text style={styles.secondaryBtnText}>Join with Code</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12,
  },
  headerTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  leaveText: { color: COLORS.error, fontWeight: '700', fontSize: 14 },
  body: { flex: 1, alignItems: 'center', paddingHorizontal: 32, paddingTop: 40 },
  jamIcon: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.card,
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  jamTitle: { color: COLORS.textPrimary, fontSize: 28, fontWeight: '900', textAlign: 'center' },
  jamSubtitle: { color: COLORS.textSecondary, fontSize: 15, textAlign: 'center', marginTop: 12, lineHeight: 22 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 30,
    paddingVertical: 16, paddingHorizontal: 32,
    marginTop: 36, width: '100%', justifyContent: 'center',
  },
  primaryBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, width: '100%' },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.textMuted, marginHorizontal: 12, fontSize: 12 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 30,
    paddingVertical: 14, paddingHorizontal: 32,
    width: '100%', justifyContent: 'center',
  },
  secondaryBtnText: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 15 },
  joinBox: { width: '100%' },
  codeInput: {
    backgroundColor: COLORS.surface, borderRadius: 8, borderWidth: 1,
    borderColor: COLORS.border, color: COLORS.textPrimary,
    fontSize: 24, fontWeight: '900', textAlign: 'center',
    paddingVertical: 16, letterSpacing: 8,
  },
  joinBtns: { flexDirection: 'row', gap: 12, marginTop: 12 },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 30, paddingVertical: 14, alignItems: 'center',
  },
  cancelBtnText: { color: COLORS.textPrimary, fontWeight: '700' },
  joinBtn: {
    flex: 1, backgroundColor: COLORS.primary,
    borderRadius: 30, paddingVertical: 14, alignItems: 'center',
  },
  joinBtnText: { color: '#000', fontWeight: '800' },
  btnDisabled: { opacity: 0.5 },
  // Active session styles
  codeSection: { alignItems: 'center', paddingTop: 20, paddingHorizontal: 24 },
  codeSectionLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 16 },
  codeBox: { flexDirection: 'row', gap: 8 },
  codeChar: {
    width: 48, height: 60, backgroundColor: COLORS.card, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  codeCharText: { color: COLORS.primary, fontSize: 28, fontWeight: '900' },
  codeActions: { flexDirection: 'row', gap: 16, marginTop: 20 },
  codeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20 },
  codeBtnText: { color: COLORS.textPrimary, fontWeight: '600' },
  nowPlaying: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.card, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8, marginHorizontal: 24, marginTop: 20,
  },
  nowPlayingText: { color: COLORS.textSecondary, fontSize: 13, flex: 1 },
  roleRow: { paddingHorizontal: 24, marginTop: 16 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  roleBadgeHost: { backgroundColor: COLORS.primary },
  roleText: { color: COLORS.textSecondary, fontSize: 13 },
  roleTextHost: { color: '#000', fontWeight: '700' },
  membersSection: { flex: 1, paddingHorizontal: 24, marginTop: 24 },
  membersSectionTitle: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 12, fontWeight: '600' },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.elevated,
    justifyContent: 'center', alignItems: 'center',
  },
  memberAvatarText: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 16 },
  memberName: { color: COLORS.textPrimary, fontSize: 15, flex: 1 },
  hostBadge: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  hostBadgeText: { color: '#000', fontSize: 11, fontWeight: '700' },
});
